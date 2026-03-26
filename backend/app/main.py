from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes_auth import router as auth_router
from app.api.routes_projects import router as projects_router
from app.api.routes_users import router as users_router
from app.core.config import settings
from app.api.routes_test_runs import router as test_runs_router
from app.api.routes_tests import router as tests_router
from app.api.routes_project_settings import router as project_settings_router

app = FastAPI(
    title="Diploma Load Testing Platform API",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health", tags=["system"])
def healthcheck():
    return {"status": "ok"}


app.include_router(auth_router, prefix="/api")
app.include_router(users_router, prefix="/api")
app.include_router(projects_router, prefix="/api")
app.include_router(test_runs_router, prefix="/api")
app.include_router(tests_router, prefix="/api")
app.include_router(project_settings_router, prefix="/api")