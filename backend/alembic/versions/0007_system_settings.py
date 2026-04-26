"""create system settings

Revision ID: 0007_system_settings
Revises: 0006_test_last_run_activity
Create Date: 2026-04-01 12:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "0007_system_settings"
down_revision = "0006_test_last_run_activity"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not inspector.has_table("system_settings"):
        op.create_table(
            "system_settings",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("allow_private_target_hosts", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("allow_test_run_launches", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.Column("max_virtual_users_per_test", sa.Integer(), nullable=False, server_default="200"),
            sa.Column("max_repeat_count_per_test", sa.Integer(), nullable=False, server_default="500"),
            sa.Column("max_timeout_seconds", sa.Integer(), nullable=False, server_default="120"),
            sa.Column("max_logs_per_run", sa.Integer(), nullable=False, server_default="500"),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )
        op.execute(
            """
            INSERT INTO system_settings (
                id,
                allow_private_target_hosts,
                allow_test_run_launches,
                max_virtual_users_per_test,
                max_repeat_count_per_test,
                max_timeout_seconds,
                max_logs_per_run
            ) VALUES (1, false, true, 200, 500, 120, 500)
            """
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if inspector.has_table("system_settings"):
        op.drop_table("system_settings")
