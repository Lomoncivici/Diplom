import asyncio
import math
import time
from statistics import mean

import httpx


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


def build_request_url(test) -> str:
    base = (test.target_url or "").strip().rstrip("/")
    path = "/" + (test.request_path or "").strip().lstrip("/")

    port = getattr(test, "target_port", None)

    if port:
        if "://" in base:
            scheme, rest = base.split("://", 1)
            if ":" not in rest:
                base = f"{scheme}://{rest}:{port}"
        else:
            if ":" not in base:
                base = f"{base}:{port}"

    return f"{base}{path}"


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


async def _single_request(
    client: httpx.AsyncClient,
    test,
    full_url: str,
    timeout_seconds: float,
    logs: list[str],
) -> dict:
    method = (test.request_method or "GET").upper()
    headers = test.request_headers or {}
    params = test.query_params or {}
    json_body = test.request_body if method in {"POST", "PUT", "PATCH", "DELETE"} else None

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
        )
        elapsed_ms = (time.perf_counter() - started) * 1000.0
        status_code = response.status_code

        expected_status = test.expected_status_code
        if expected_status is None:
            ok = 200 <= response.status_code < 400
        else:
            ok = response.status_code == expected_status

        if ok:
            logs.append(
                f"{method} {response.request.url} -> {response.status_code} ({elapsed_ms:.2f} ms)"
            )
        else:
            logs.append(
                f"{method} {response.request.url} -> {response.status_code}, "
                f"expected {expected_status} ({elapsed_ms:.2f} ms)"
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
        logs.append(
            f"{method} {full_url} params={params} timeout={timeout_seconds}s -> ERROR: {error_message}"
        )
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
):
    virtual_users = max(int(test.virtual_users or 1), 1)

    # Плавное подключение пользователей
    if ramp_up_seconds > 0 and virtual_users > 1:
        start_delay = ramp_up_seconds * (user_index / (virtual_users - 1))
        await asyncio.sleep(start_delay)

    for iteration in range(repeat_count):
        result = await _single_request(
            client=client,
            test=test,
            full_url=full_url,
            timeout_seconds=timeout_seconds,
            logs=logs,
        )
        results.append(result)

        # Плавное снижение активности на последних итерациях
        # чем ближе к концу, тем длиннее пауза
        if iteration < repeat_count - 1:
            if ramp_down_seconds > 0 and repeat_count > 1:
                progress = iteration / (repeat_count - 1)  # 0..1
                extra_delay = ramp_down_seconds * progress / repeat_count
                await asyncio.sleep(extra_delay)
            else:
                await asyncio.sleep(0)


async def run_api_test(test) -> dict:
    vu = max(int(test.virtual_users or 1), 1)
    repeat_count = max(int(getattr(test, "repeat_count", 1) or 1), 1)

    timeout_seconds = parse_duration_to_seconds(getattr(test, "timeout", None), default=30)
    ramp_up_seconds = parse_duration_to_seconds(getattr(test, "ramp_up", None), default=0)
    ramp_down_seconds = parse_duration_to_seconds(getattr(test, "ramp_down", None), default=0)

    logs: list[str] = []
    results: list[dict] = []

    full_url = build_request_url(test)
    start_ts = time.perf_counter()

    async with httpx.AsyncClient() as client:
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
        f"Avg: {avg_ms} ms | "
        f"P95: {p95_ms} ms | "
        f"RPS: {throughput}"
    )

    final_status = "success" if error_count == 0 else "completed_with_errors"

    return {
        "status": final_status,
        "summary": summary,
        "logs": "\n".join(logs[-500:]),
        "avg_response_ms": avg_ms,
        "p95_response_ms": p95_ms,
        "error_rate": error_rate,
        "throughput": throughput,
        "requests_total": len(results),
        "requests_success": ok_count,
        "requests_failed": error_count,
    }