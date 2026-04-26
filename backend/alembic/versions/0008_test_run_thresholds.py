"""add threshold results to test runs

Revision ID: 0008_test_run_thresholds
Revises: 0007_system_settings
Create Date: 2026-04-01
"""

from alembic import op
import sqlalchemy as sa


revision = "0008_test_run_thresholds"
down_revision = "0007_system_settings"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("test_runs")}

    if "threshold_passed" not in columns:
        op.add_column("test_runs", sa.Column("threshold_passed", sa.Boolean(), nullable=True))

    if "threshold_results" not in columns:
        op.add_column("test_runs", sa.Column("threshold_results", sa.JSON(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("test_runs")}

    if "threshold_results" in columns:
        op.drop_column("test_runs", "threshold_results")

    if "threshold_passed" in columns:
        op.drop_column("test_runs", "threshold_passed")
