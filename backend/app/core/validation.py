import ipaddress
import json
import socket
from urllib.parse import urlsplit

from pydantic import ValidationInfo

ALLOWED_HTTP_METHODS = {"GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"}
FORBIDDEN_REQUEST_HEADERS = {"host", "content-length", "transfer-encoding", "connection"}
URL_ALLOWED_SCHEMES = {"http", "https"}
JSON_SCALAR_TYPES = (str, int, float, bool, type(None))


def normalize_email(email: str) -> str:
    return email.strip().lower()


def validate_password_strength(password: str) -> str:
    if len(password) < 8:
        raise ValueError("Пароль должен содержать не менее 8 символов")
    if len(password) > 128:
        raise ValueError("Пароль должен содержать не более 128 символов")
    if password.strip() != password:
        raise ValueError("Пароль не должен начинаться или заканчиваться пробелом")
    if not any(ch.islower() for ch in password):
        raise ValueError("Пароль должен содержать строчную букву")
    if not any(ch.isupper() for ch in password):
        raise ValueError("Пароль должен содержать заглавную букву")
    if not any(ch.isdigit() for ch in password):
        raise ValueError("Пароль должен содержать цифру")
    return password


def validate_http_url(value: str | None, *, field_name: str = "URL") -> str | None:
    if value is None:
        return None

    raw = value.strip()
    if not raw:
        return None
    if len(raw) > 500:
        raise ValueError(f"{field_name} слишком длинный")

    parsed = urlsplit(raw)
    if parsed.scheme not in URL_ALLOWED_SCHEMES:
        raise ValueError(f"{field_name} должен начинаться с http:// или https://")
    if not parsed.hostname:
        raise ValueError(f"{field_name} должен содержать имя хоста")
    if parsed.username or parsed.password:
        raise ValueError(f"{field_name} не должен содержать встроенные учётные данные")

    return raw.rstrip("/")


def validate_port(value: str | None) -> str | None:
    if value is None:
        return None
    raw = str(value).strip()
    if not raw:
        return None
    if not raw.isdigit():
        raise ValueError("Порт должен содержать только цифры")
    port = int(raw)
    if not 1 <= port <= 65535:
        raise ValueError("Порт должен быть в диапазоне от 1 до 65535")
    return str(port)


def validate_duration(value: str | None, *, field_name: str, allow_none: bool = True) -> str | None:
    if value is None:
        return None if allow_none else ""

    raw = str(value).strip().lower()
    if not raw:
        return None if allow_none else ""

    suffix = raw[-1]
    number_part = raw[:-1] if suffix in {"s", "m", "h"} else raw
    if suffix not in {"s", "m", "h"} and not raw.endswith("ms"):
        raise ValueError(f"{field_name} должен оканчиваться на ms, s, m или h")
    if raw.endswith("ms"):
        number_part = raw[:-2]

    try:
        numeric = float(number_part)
    except ValueError as exc:
        raise ValueError(f"{field_name} содержит некорректное число") from exc

    if numeric <= 0:
        raise ValueError(f"{field_name} должно быть больше нуля")
    if numeric > 24 * 60 * 60:
        raise ValueError(f"{field_name} слишком велико")

    return raw


def validate_request_method(value: str) -> str:
    method = value.strip().upper()
    if method not in ALLOWED_HTTP_METHODS:
        raise ValueError(f"Неподдерживаемый метод запроса: {method}")
    return method


def validate_status_code(value: int | None) -> int | None:
    if value is None:
        return None
    if not 100 <= int(value) <= 599:
        raise ValueError("Ожидаемый код ответа должен быть в диапазоне от 100 до 599")
    return int(value)


def validate_non_negative_int(value: int | None, *, field_name: str, minimum: int = 0, maximum: int | None = None) -> int | None:
    if value is None:
        return None
    numeric = int(value)
    if numeric < minimum:
        raise ValueError(f"{field_name} должно быть не меньше {minimum}")
    if maximum is not None and numeric > maximum:
        raise ValueError(f"{field_name} должно быть не больше {maximum}")
    return numeric


def _validate_json_value(value, *, location: str):
    if isinstance(value, JSON_SCALAR_TYPES):
        if isinstance(value, str) and ("\r" in value or "\n" in value):
            return value
        return value
    if isinstance(value, list):
        if len(value) > 200:
            raise ValueError(f"{location} содержит слишком много элементов")
        return [_validate_json_value(item, location=f"{location}[]") for item in value]
    if isinstance(value, dict):
        if len(value) > 200:
            raise ValueError(f"{location} содержит слишком много ключей")
        return {str(key): _validate_json_value(item, location=f"{location}.{key}") for key, item in value.items()}
    raise ValueError(f"{location} содержит значение, которое не поддерживается JSON")


def validate_generic_json_map(value: dict | None, *, field_name: str) -> dict | None:
    if value is None:
        return None
    if not isinstance(value, dict):
        raise ValueError(f"{field_name} должно быть объектом JSON")
    normalized = _validate_json_value(value, location=field_name)
    serialized = json.dumps(normalized, ensure_ascii=False)
    if len(serialized) > 20_000:
        raise ValueError(f"{field_name} слишком велико")
    return normalized


def validate_headers(value: dict | None) -> dict | None:
    headers = validate_generic_json_map(value, field_name="Headers")
    if headers is None:
        return None

    normalized: dict[str, str] = {}
    for raw_name, raw_value in headers.items():
        name = str(raw_name).strip()
        if not name:
            raise ValueError("Имя заголовка не должно быть пустым")
        if any(ch in name for ch in "\r\n:"):
            raise ValueError(f"Некорректное имя заголовка: {name}")
        if name.lower() in FORBIDDEN_REQUEST_HEADERS:
            raise ValueError(f"Заголовок '{name}' управляется HTTP-клиентом и не может быть переопределён")

        value_text = raw_value if isinstance(raw_value, str) else json.dumps(raw_value, ensure_ascii=False)
        if "\r" in value_text or "\n" in value_text:
            raise ValueError(f"Заголовок '{name}' содержит недопустимое значение")
        normalized[name] = value_text

    return normalized


def is_private_or_local_host(hostname: str) -> bool:
    normalized = hostname.strip().lower()
    if normalized in {"localhost", "localhost.localdomain"}:
        return True

    try:
        candidate = ipaddress.ip_address(normalized)
        return any(
            (
                candidate.is_private,
                candidate.is_loopback,
                candidate.is_link_local,
                candidate.is_multicast,
                candidate.is_reserved,
                candidate.is_unspecified,
            )
        )
    except ValueError:
        pass

    try:
        resolved = {info[4][0] for info in socket.getaddrinfo(normalized, None)}
    except socket.gaierror:
        return False

    for addr in resolved:
        try:
            candidate = ipaddress.ip_address(addr)
        except ValueError:
            continue
        if any(
            (
                candidate.is_private,
                candidate.is_loopback,
                candidate.is_link_local,
                candidate.is_multicast,
                candidate.is_reserved,
                candidate.is_unspecified,
            )
        ):
            return True
    return False
