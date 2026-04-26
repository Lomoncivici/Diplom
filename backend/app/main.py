from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response

from app.api.routes_auth import router as auth_router
from app.api.routes_project_settings import router as project_settings_router
from app.api.routes_projects import router as projects_router
from app.api.routes_test_runs import router as test_runs_router
from app.api.routes_tests import router as tests_router
from app.api.routes_users import router as users_router
from app.api.routes_system_settings import router as system_settings_router
from app.api.routes_support_chat import router as support_chat_router
from app.core.config import settings
from app.schemas.database_backup import HealthStatusResponse
from app.services.platform_status_service import platform_status_service

app = FastAPI(
    title="Diploma Load Testing Platform API",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

ALLOWED_TECHNICAL_WORKS_PATHS = {
    "/api/health",
    "/api/admin/database-backup",
    "/api/admin/database-backup/automatic",
    "/api/admin/database-restore",
}


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    platform_status = platform_status_service.get_snapshot()

    if (
        platform_status.technical_works_active
        and request.method in {"POST", "PUT", "PATCH", "DELETE"}
        and request.url.path not in ALLOWED_TECHNICAL_WORKS_PATHS
    ):
        return JSONResponse(
            status_code=503,
            content={
                "detail": platform_status.technical_works_message
                or "Сейчас идут технические работы. Повторите действие позже.",
            },
        )

    response: Response = await call_next(request)
    platform_status = platform_status_service.get_snapshot()
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
    if settings.environment == "production":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

    if platform_status.technical_works_active:
        response.headers["X-Technical-Works-Active"] = "1"
        response.headers["X-Technical-Works"] = "true"
    else:
        response.headers["X-Technical-Works"] = "false"

    return response


@app.get("/api/health", tags=["system"], response_model=HealthStatusResponse)
def healthcheck():
    platform_status = platform_status_service.get_snapshot()
    return HealthStatusResponse(
        status="ok",
        technical_works_active=platform_status.technical_works_active,
        technical_works_message=platform_status.technical_works_message,
        technical_works_operation=platform_status.current_operation,
    )


app.include_router(auth_router, prefix="/api")
app.include_router(users_router, prefix="/api")
app.include_router(projects_router, prefix="/api")
app.include_router(test_runs_router, prefix="/api")
app.include_router(tests_router, prefix="/api")
app.include_router(project_settings_router, prefix="/api")
app.include_router(system_settings_router, prefix="/api")

app.include_router(support_chat_router, prefix="/api")
