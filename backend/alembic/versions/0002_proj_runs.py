"""add project settings, test scenarios and test runs

Revision ID: 0002_proj_runs
Revises: 0001_init
Create Date: 2026-03-16

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0002_proj_runs"
down_revision: Union[str, None] = "0001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "project_settings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("project_id", sa.Integer(), nullable=False, unique=True),
        sa.Column("project_type", sa.String(length=50), nullable=False, server_default="api"),
        sa.Column("test_type", sa.String(length=50), nullable=False, server_default="load"),
        sa.Column("environment", sa.String(length=50), nullable=False, server_default="local"),
        sa.Column("target_url", sa.String(length=500), nullable=True),
        sa.Column("target_port", sa.String(length=20), nullable=True),
        sa.Column("goal", sa.Text(), nullable=True),
        sa.Column("success_criteria", sa.Text(), nullable=True),
        sa.Column("virtual_users", sa.Integer(), nullable=False, server_default="50"),
        sa.Column("duration", sa.String(length=50), nullable=False, server_default="5m"),
        sa.Column("ramp_up", sa.String(length=50), nullable=False, server_default="30s"),
        sa.Column("ramp_down", sa.String(length=50), nullable=False, server_default="15s"),
        sa.Column("timeout", sa.String(length=50), nullable=False, server_default="30s"),
        sa.Column("repeat_count", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("monitoring_enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("prometheus_url", sa.String(length=500), nullable=True),
        sa.Column("grafana_url", sa.String(length=500), nullable=True),
        sa.Column("max_avg_response_ms", sa.Integer(), nullable=False, server_default="500"),
        sa.Column("max_p95_ms", sa.Integer(), nullable=False, server_default="1000"),
        sa.Column("max_error_rate", sa.Integer(), nullable=False, server_default="2"),
        sa.Column("min_throughput", sa.Integer(), nullable=False, server_default="100"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_project_settings_project_id", "project_settings", ["project_id"], unique=True)

    op.create_table(
        "test_scenarios",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("scenario_type", sa.String(length=50), nullable=False, server_default="http"),
        sa.Column("script_content", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_test_scenarios_project_id", "test_scenarios", ["project_id"], unique=False)

    op.create_table(
        "test_runs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("scenario_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="created"),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("logs", sa.Text(), nullable=True),
        sa.Column("avg_response_ms", sa.Integer(), nullable=True),
        sa.Column("p95_response_ms", sa.Integer(), nullable=True),
        sa.Column("error_rate", sa.Integer(), nullable=True),
        sa.Column("throughput", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["scenario_id"], ["test_scenarios.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_test_runs_scenario_id", "test_runs", ["scenario_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_test_runs_scenario_id", table_name="test_runs")
    op.drop_table("test_runs")

    op.drop_index("ix_test_scenarios_project_id", table_name="test_scenarios")
    op.drop_table("test_scenarios")

    op.drop_index("ix_project_settings_project_id", table_name="project_settings")
    op.drop_table("project_settings")