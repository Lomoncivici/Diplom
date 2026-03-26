"""add tests table and move runs from scenarios to tests

Revision ID: 0003_tests
Revises: 0002_proj_runs
Create Date: 2026-03-21
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0003_tests"
down_revision: Union[str, None] = "0002_proj_runs"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "tests",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("goal", sa.Text(), nullable=True),
        sa.Column("target_entity", sa.String(length=255), nullable=True),

        sa.Column("project_type", sa.String(length=50), nullable=False, server_default="api"),
        sa.Column("test_type", sa.String(length=50), nullable=False, server_default="load"),
        sa.Column("environment", sa.String(length=50), nullable=False, server_default="local"),

        sa.Column("target_url", sa.String(length=500), nullable=True),
        sa.Column("target_port", sa.String(length=20), nullable=True),
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

        sa.Column("scenario_type", sa.String(length=50), nullable=False, server_default="http"),
        sa.Column("script_content", sa.Text(), nullable=True),

        sa.Column("status", sa.String(length=50), nullable=False, server_default="draft"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),

        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_tests_project_id", "tests", ["project_id"], unique=False)

    op.add_column("test_runs", sa.Column("test_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_test_runs_test_id_tests",
        "test_runs",
        "tests",
        ["test_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index("ix_test_runs_test_id", "test_runs", ["test_id"], unique=False)

    conn = op.get_bind()

    scenarios = conn.execute(sa.text("""
        SELECT
            ts.id AS scenario_id,
            ts.project_id AS project_id,
            ts.name AS name,
            ts.description AS description,
            ts.scenario_type AS scenario_type,
            ts.script_content AS script_content,

            ps.goal AS goal,
            ps.project_type AS project_type,
            ps.test_type AS test_type,
            ps.environment AS environment,
            ps.target_url AS target_url,
            ps.target_port AS target_port,
            ps.success_criteria AS success_criteria,
            ps.virtual_users AS virtual_users,
            ps.duration AS duration,
            ps.ramp_up AS ramp_up,
            ps.ramp_down AS ramp_down,
            ps.timeout AS timeout,
            ps.repeat_count AS repeat_count,
            ps.monitoring_enabled AS monitoring_enabled,
            ps.prometheus_url AS prometheus_url,
            ps.grafana_url AS grafana_url,
            ps.max_avg_response_ms AS max_avg_response_ms,
            ps.max_p95_ms AS max_p95_ms,
            ps.max_error_rate AS max_error_rate,
            ps.min_throughput AS min_throughput
        FROM test_scenarios ts
        LEFT JOIN project_settings ps ON ps.project_id = ts.project_id
    """)).mappings().all()

    scenario_to_test_id: dict[int, int] = {}

    for row in scenarios:
        result = conn.execute(sa.text("""
            INSERT INTO tests (
                project_id,
                name,
                description,
                goal,
                target_entity,
                project_type,
                test_type,
                environment,
                target_url,
                target_port,
                success_criteria,
                virtual_users,
                duration,
                ramp_up,
                ramp_down,
                timeout,
                repeat_count,
                monitoring_enabled,
                prometheus_url,
                grafana_url,
                max_avg_response_ms,
                max_p95_ms,
                max_error_rate,
                min_throughput,
                scenario_type,
                script_content,
                status
            )
            VALUES (
                :project_id,
                :name,
                :description,
                :goal,
                NULL,
                COALESCE(:project_type, 'api'),
                COALESCE(:test_type, 'load'),
                COALESCE(:environment, 'local'),
                :target_url,
                :target_port,
                :success_criteria,
                COALESCE(:virtual_users, 50),
                COALESCE(:duration, '5m'),
                COALESCE(:ramp_up, '30s'),
                COALESCE(:ramp_down, '15s'),
                COALESCE(:timeout, '30s'),
                COALESCE(:repeat_count, 1),
                COALESCE(:monitoring_enabled, true),
                :prometheus_url,
                :grafana_url,
                COALESCE(:max_avg_response_ms, 500),
                COALESCE(:max_p95_ms, 1000),
                COALESCE(:max_error_rate, 2),
                COALESCE(:min_throughput, 100),
                COALESCE(:scenario_type, 'http'),
                :script_content,
                'draft'
            )
            RETURNING id
        """), dict(row))

        new_test_id = result.scalar_one()
        scenario_to_test_id[row["scenario_id"]] = new_test_id

    old_runs = conn.execute(sa.text("""
        SELECT id, scenario_id
        FROM test_runs
    """)).mappings().all()

    for run in old_runs:
        test_id = scenario_to_test_id.get(run["scenario_id"])
        if test_id is not None:
            conn.execute(
                sa.text("""
                    UPDATE test_runs
                    SET test_id = :test_id
                    WHERE id = :run_id
                """),
                {"test_id": test_id, "run_id": run["id"]},
            )

    op.alter_column("test_runs", "test_id", nullable=False)

    op.drop_index("ix_test_runs_scenario_id", table_name="test_runs")
    op.drop_constraint(
        op.f("test_runs_scenario_id_fkey") if False else "test_runs_scenario_id_fkey",
        "test_runs",
        type_="foreignkey",
    )
    op.drop_column("test_runs", "scenario_id")


def downgrade() -> None:
    op.add_column("test_runs", sa.Column("scenario_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "test_runs_scenario_id_fkey",
        "test_runs",
        "test_scenarios",
        ["scenario_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index("ix_test_runs_scenario_id", "test_runs", ["scenario_id"], unique=False)

    op.drop_constraint("fk_test_runs_test_id_tests", "test_runs", type_="foreignkey")
    op.drop_index("ix_test_runs_test_id", table_name="test_runs")
    op.drop_column("test_runs", "test_id")

    op.drop_index("ix_tests_project_id", table_name="tests")
    op.drop_table("tests")