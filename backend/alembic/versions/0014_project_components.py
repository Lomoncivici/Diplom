"""структура тестируемой системы и внешние интеграции

Revision ID: 0014_project_components
Revises: 0013_tested_system_fields
Create Date: 2026-04-28 15:30:00
"""

from alembic import op
import sqlalchemy as sa


revision = "0014_project_components"
down_revision = "0013_tested_system_fields"
branch_labels = None
depends_on = None


component_type_check = "component_type in ('internal_component', 'external_integration')"
criticality_level_check = "criticality_level in ('critical', 'important', 'optional')"


def upgrade() -> None:
    op.create_table(
        "project_components",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("component_type", sa.String(length=50), nullable=False, server_default="internal_component"),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("endpoint_url", sa.String(length=500), nullable=True),
        sa.Column("responsible_name", sa.String(length=255), nullable=True),
        sa.Column("criticality_level", sa.String(length=50), nullable=False, server_default="important"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint(component_type_check, name="ck_project_components_component_type"),
        sa.CheckConstraint(criticality_level_check, name="ck_project_components_criticality_level"),
    )
    op.create_index(op.f("ix_project_components_project_id"), "project_components", ["project_id"], unique=False)
    op.alter_column("project_components", "component_type", server_default=None)
    op.alter_column("project_components", "criticality_level", server_default=None)


def downgrade() -> None:
    op.drop_index(op.f("ix_project_components_project_id"), table_name="project_components")
    op.drop_table("project_components")
