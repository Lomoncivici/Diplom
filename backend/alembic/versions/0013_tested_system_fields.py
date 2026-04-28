"""добавление полей тестируемой системы в проекты

Revision ID: 0013_tested_system_fields
Revises: 0012_email_security
Create Date: 2026-04-28 00:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = "0013_tested_system_fields"
down_revision = "0012_email_security"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "projects",
        sa.Column("system_type", sa.String(length=50), nullable=False, server_default="api"),
    )
    op.add_column(
        "projects",
        sa.Column("base_url", sa.String(length=500), nullable=True),
    )
    op.add_column(
        "projects",
        sa.Column("environment_name", sa.String(length=120), nullable=True),
    )
    op.add_column(
        "projects",
        sa.Column("system_owner", sa.String(length=255), nullable=True),
    )
    op.alter_column("projects", "system_type", server_default=None)


def downgrade() -> None:
    op.drop_column("projects", "system_owner")
    op.drop_column("projects", "environment_name")
    op.drop_column("projects", "base_url")
    op.drop_column("projects", "system_type")
