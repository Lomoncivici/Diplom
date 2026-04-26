import asyncio
import math
import time
from statistics import mean
from urllib.parse import urlsplit, urlunsplit

import httpx
from fastapi import HTTPException, status

from app.core.config import settings
from app.core.validation import is_private_or_local_host
from app.services.system_settings_service import get_effective_allow_private_target_hosts

SAFE_HTTPX_TIMEOUT_LIMIT_SECONDS = 300
SAFE_HTTPX_CONNECT_TIMEOUT_SECONDS = 10


def percentile(values: list[float], p: float) -> float | None:
    if not values:
        return None
    values = sorted(values)
    k = (len(values) - 1) * p
    f = math.floor(k)
    c = math.ceil(k)
    if f == c:
        return values[int(k)]
    d0 = values[f] * (c - k)
    d1 = values[c] * (k - f)
    return d0 + d1


def validate_target_destination(full_url: str, allow_private_target_hosts: bool) -> str:
    parsed = urlsplit(full_url)
    if parsed.scheme not in {"http", "https"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Разрешены только адреса с протоколами http и https",
        )
    if not parsed.hostname:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Указан некорректный адрес сервиса")
    if parsed.username or parsed.password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="В адресе сервиса нельзя передавать логин и пароль",
        )
    if not allow_private_target_hosts and is_private_or_local_host(parsed.hostname):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Запросы к localhost, приватным и зарезервированным сетевым адресам запрещены. "
                "Разрешайте такие адреса только в доверенной локальной среде разработки."
            ),
        )
    return full_url


def build_request_url(test, allow_private_target_hosts: bool) -> str:
    base = (test.target_url or "").strip().rstrip("/")
    if not base:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Укажите адрес сервиса")

    parsed_base = urlsplit(base)
    if parsed_base.scheme not in {"http", "https"} or not parsed_base.hostname:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Адрес сервиса должен содержать корректный сетевой адрес",
        )

    port = getattr(test, "target_port", None)
    netloc = parsed_base.hostname or ""
    if port:
        netloc = f"{netloc}:{port}"
    elif parsed_base.port:
        netloc = f"{netloc}:{parsed_base.port}"

    path = parsed_base.path.rstrip("/")
    request_path = (test.request_path or "").strip()
    if request_path:
        if not request_path.startswith("/"):
            request_path = f"/{request_path}"
        path = f"{path}{request_path}"
    if not path:
        path = "/"

    full_url = urlunsplit((parsed_base.scheme, netloc, path, parsed_base.query, parsed_base.fragment))
    return validate_target_destination(full_url, allow_private_target_hosts=allow_private_target_hosts)


def parse_duration_to_seconds(value: str | int | float | None, default: float = 0) -> float:
    if value is None:
        return default

    if isinstance(value, (int, float)):
        return float(value)

    raw = str(value).strip().lower()
    if not raw:
        return default

    if raw.endswith("ms"):
        return float(raw[:-2]) / 1000.0
    if raw.endswith("s"):
        return float(raw[:-1])
    if raw.endswith("m"):
        return float(raw[:-1]) * 60.0
    if raw.endswith("h"):
        return float(raw[:-1]) * 3600.0

    return float(raw)


def choose_bucket_size(total_time: float) -> float:
    if total_time <= 2:
        return 0.2
    if total_time <= 5:
        return 0.5
    if total_time <= 30:
        return 1.0
    return 2.0


def evaluate_thresholds(test, result: dict) -> tuple[bool | None, list[dict]]:
    checks = [
        (
            "max_avg_response_ms",
            "Среднее время ответа",
            "не более",
            result.get("avg_response_ms"),
            test.max_avg_response_ms,
            lambda actual, target: actual <= target,
            "мс",
        ),
        (
            "max_p95_ms",
            "95-й процентиль",
            "не более",
            result.get("p95_response_ms"),
            test.max_p95_ms,
            lambda actual, target: actual <= target,
            "мс",
        ),
        (
            "max_error_rate",
            "Доля ошибок",
            "не более",
            result.get("error_rate"),
            test.max_error_rate,
            lambda actual, target: actual <= target,
            "%",
        ),
        (
            "min_throughput",
            "Пропускная способность",
            "не менее",
            result.get("throughput"),
            test.min_throughput,
            lambda actual, target: actual >= target,
            "запр./с",
        ),
    ]

    results: list[dict] = []
    configured_checks = 0

    for key, label, operator, actual, target, predicate, unit in checks:
        if target is None:
            continue

        configured_checks += 1
        actual_value = None if actual is None else round(float(actual), 2)
        target_value = round(float(target), 2)
        passed = actual_value is not None and predicate(actual_value, target_value)

        results.append(
            {
                "key": key,
                "label": label,
                "operator": operator,
                "actual": actual_value,
                "target": target_value,
                "unit": unit,
                "passed": passed,
            }
        )

    if configured_checks == 0:
        return None, []

    return all(item["passed"] for item in results), results


def build_activity_timeline(
    total_time: float,
    vu_intervals: list[tuple[float, float]],
    request_started_at: list[float],
) -> list[dict]:
    bucket_size = choose_bucket_size(total_time)
    bucket_count = max(int(math.ceil(total_time / bucket_size)), 1)

    timeline: list[dict] = []

    for bucket_index in range(bucket_count):
        bucket_start = bucket_index * bucket_size
        bucket_end = bucket_start + bucket_size

        active_users = sum(
            1
            for started_at, finished_at in vu_intervals
            if started_at < bucket_end and finished_at > bucket_start
        )

        requests_sent = sum(1 for ts in request_started_at if bucket_start <= ts < bucket_end)

        timeline.append(
            {
                "second": round(bucket_start, 2),
                "label": f"{bucket_start:.1f} с",
                "active_users": active_users,
                "requests_sent": requests_sent,
            }
        )

    return timeline


async def _single_request(
    client: httpx.AsyncClient,
    test,
    full_url: str,
    timeout_seconds: float,
    logs: list[str],
    request_started_at: list[float],
    run_started_at: float,
) -> dict:
    method = (test.request_method or "GET").upper()
    headers = test.request_headers or {}
    params = test.query_params or {}
    json_body = test.request_body if method in {"POST", "PUT", "PATCH", "DELETE"} else None

    request_started_at.append(time.perf_counter() - run_started_at)

    started = time.perf_counter()
    status_code = None

    try:
        response = await client.request(
            method=method,
            url=full_url,
            headers=headers,
            params=params,
            json=json_body,
            timeout=timeout_seconds,
            follow_redirects=False,
        )
        elapsed_ms = (time.perf_counter() - started) * 1000.0
        status_code = response.status_code

        expected_status = test.expected_status_code
        if expected_status is None:
            ok = 200 <= response.status_code < 400
        else:
            ok = response.status_code == expected_status

        if ok:
            logs.append(f"{method} {response.request.url} -> {response.status_code} ({elapsed_ms:.2f} мс)")
        else:
            logs.append(
                f"{method} {response.request.url} -> {response.status_code}, "
                f"ожидался код {expected_status} ({elapsed_ms:.2f} мс)"
            )

        return {
            "ok": ok,
            "elapsed_ms": elapsed_ms,
            "status_code": status_code,
            "error": None,
        }
    except Exception as exc:
        elapsed_ms = (time.perf_counter() - started) * 1000.0
        error_message = f"{type(exc).__name__}: {exc}"
        logs.append(f"{method} {full_url} параметры={params} таймаут={timeout_seconds}с -> ОШИБКА: {error_message}")
        return {
            "ok": False,
            "elapsed_ms": elapsed_ms,
            "status_code": status_code,
            "error": error_message,
        }


async def _virtual_user(
    user_index: int,
    client: httpx.AsyncClient,
    test,
    full_url: str,
    timeout_seconds: float,
    repeat_count: int,
    ramp_up_seconds: float,
    ramp_down_seconds: float,
    logs: list[str],
    results: list[dict],
    vu_intervals: list[tuple[float, float]],
    request_started_at: list[float],
    run_started_at: float,
):
    virtual_users = max(int(test.virtual_users or 1), 1)

    if ramp_up_seconds > 0 and virtual_users > 1:
        start_delay = ramp_up_seconds * (user_index / (virtual_users - 1))
        await asyncio.sleep(start_delay)

    vu_started = time.perf_counter() - run_started_at

    for iteration in range(repeat_count):
        result = await _single_request(
            client=client,
            test=test,
            full_url=full_url,
            timeout_seconds=timeout_seconds,
            logs=logs,
            request_started_at=request_started_at,
            run_started_at=run_started_at,
        )
        results.append(result)

        if iteration < repeat_count - 1:
            if ramp_down_seconds > 0 and repeat_count > 1:
                progress = iteration / (repeat_count - 1)
                extra_delay = ramp_down_seconds * progress / repeat_count
                await asyncio.sleep(extra_delay)
            else:
                await asyncio.sleep(0)

    vu_finished = time.perf_counter() - run_started_at
    vu_intervals.append((vu_started, vu_finished))


async def run_api_test(test, runtime_settings=None) -> dict:
    runtime_settings = runtime_settings or settings
    allow_private_target_hosts = get_effective_allow_private_target_hosts(runtime_settings)
    allow_test_run_launches = bool(getattr(runtime_settings, "allow_test_run_launches", True))
    max_virtual_users = int(getattr(runtime_settings, "max_virtual_users_per_test", 200))
    max_repeat_count = int(getattr(runtime_settings, "max_repeat_count_per_test", 500))
    max_timeout_seconds = int(getattr(runtime_settings, "max_timeout_seconds", 120))
    max_logs_per_run = int(getattr(runtime_settings, "max_logs_per_run", 500))

    if not allow_test_run_launches:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Запуск новых тестов временно отключён администратором.",
        )

    vu = max(int(test.virtual_users or 1), 1)
    if vu > max_virtual_users:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Количество виртуальных пользователей превышает допустимый предел ({max_virtual_users}).",
        )

    repeat_count = max(int(getattr(test, "repeat_count", 1) or 1), 1)
    if repeat_count > max_repeat_count:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Количество повторов превышает допустимый предел ({max_repeat_count}).",
        )

    timeout_seconds = min(
        parse_duration_to_seconds(getattr(test, "timeout", None), default=30),
        SAFE_HTTPX_TIMEOUT_LIMIT_SECONDS,
    )
    if timeout_seconds > max_timeout_seconds:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Таймаут превышает допустимый предел ({max_timeout_seconds} с).",
        )

    ramp_up_seconds = parse_duration_to_seconds(getattr(test, "ramp_up", None), default=0)
    ramp_down_seconds = parse_duration_to_seconds(getattr(test, "ramp_down", None), default=0)

    logs: list[str] = []
    results: list[dict] = []
    vu_intervals: list[tuple[float, float]] = []
    request_started_at: list[float] = []

    full_url = build_request_url(test, allow_private_target_hosts=allow_private_target_hosts)
    start_ts = time.perf_counter()

    timeout = httpx.Timeout(timeout_seconds, connect=min(timeout_seconds, SAFE_HTTPX_CONNECT_TIMEOUT_SECONDS))
    limits = httpx.Limits(max_connections=min(max(vu, 1), 100), max_keepalive_connections=20)

    async with httpx.AsyncClient(timeout=timeout, limits=limits) as client:
        tasks = [
            _virtual_user(
                user_index=i,
                client=client,
                test=test,
                full_url=full_url,
                timeout_seconds=timeout_seconds,
                repeat_count=repeat_count,
                ramp_up_seconds=ramp_up_seconds,
                ramp_down_seconds=ramp_down_seconds,
                logs=logs,
                results=results,
                vu_intervals=vu_intervals,
                request_started_at=request_started_at,
                run_started_at=start_ts,
            )
            for i in range(vu)
        ]
        await asyncio.gather(*tasks)

    total_time = max(time.perf_counter() - start_ts, 0.001)

    timings = [r["elapsed_ms"] for r in results]
    ok_count = sum(1 for r in results if r["ok"])
    error_count = len(results) - ok_count

    avg_ms = round(mean(timings), 2) if timings else None
    p95_value = percentile(timings, 0.95) if timings else None
    p95_ms = round(p95_value, 2) if p95_value is not None else None
    error_rate = round((error_count / len(results)) * 100, 2) if results else 0.0
    throughput = round(len(results) / total_time, 2) if total_time > 0 else 0.0

    summary = (
        f"Запросов: {len(results)} | "
        f"Успешно: {ok_count} | "
        f"Ошибок: {error_count} | "
        f"Среднее время ответа: {avg_ms} мс | "
        f"95-й процентиль: {p95_ms} мс | "
        f"Пропускная способность: {throughput}"
    )

    final_status = "success" if error_count == 0 else "completed_with_errors"

    activity_timeline = build_activity_timeline(
        total_time=total_time,
        vu_intervals=vu_intervals,
        request_started_at=request_started_at,
    )

    threshold_passed, threshold_results = evaluate_thresholds(
        test,
        {
            "avg_response_ms": avg_ms,
            "p95_response_ms": p95_ms,
            "error_rate": error_rate,
            "throughput": throughput,
        },
    )

    if threshold_passed is True:
        summary += " | Пороговые проверки: пройдены"
    elif threshold_passed is False:
        summary += " | Пороговые проверки: не пройдены"
    else:
        summary += " | Пороговые проверки: не настроены"

    return {
        "status": final_status,
        "summary": summary,
        "logs": "\n".join(logs[-max_logs_per_run:]),
        "avg_response_ms": avg_ms,
        "p95_response_ms": p95_ms,
        "error_rate": error_rate,
        "throughput": throughput,
        "requests_total": len(results),
        "requests_success": ok_count,
        "requests_failed": error_count,
        "activity_timeline": activity_timeline,
        "threshold_passed": threshold_passed,
        "threshold_results": threshold_results,
    }
