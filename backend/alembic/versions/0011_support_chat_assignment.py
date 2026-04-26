"""закрепление чатов поддержки за администратором

Revision ID: 0011_support_chat_assignment
Revises: 0010_support_chat_update
Create Date: 2026-04-26 00:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = "0011_support_chat_assignment"
down_revision = "0010_support_chat_update"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not inspector.has_table("support_conversations"):
        return

    columns = {column["name"] for column in inspector.get_columns("support_conversations")}
    indexes = {index["name"] for index in inspector.get_indexes("support_conversations") if index.get("name")}
    foreign_keys = {fk["name"] for fk in inspector.get_foreign_keys("support_conversations") if fk.get("name")}

    if "assigned_admin_id" not in columns:
        op.add_column("support_conversations", sa.Column("assigned_admin_id", sa.Integer(), nullable=True))

    if "assigned_at" not in columns:
        op.add_column("support_conversations", sa.Column("assigned_at", sa.DateTime(timezone=True), nullable=True))

    if "fk_support_conversations_assigned_admin_id_users" not in foreign_keys:
        op.create_foreign_key(
            "fk_support_conversations_assigned_admin_id_users",
            "support_conversations",
            "users",
            ["assigned_admin_id"],
            ["id"],
            ondelete="SET NULL",
        )

    if "ix_support_conversations_assigned_admin_id" not in indexes:
        op.create_index(
            "ix_support_conversations_assigned_admin_id",
            "support_conversations",
            ["assigned_admin_id"],
            unique=False,
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not inspector.has_table("support_conversations"):
        return

    columns = {column["name"] for column in inspector.get_columns("support_conversations")}
    indexes = {index["name"] for index in inspector.get_indexes("support_conversations") if index.get("name")}
    foreign_keys = {fk["name"] for fk in inspector.get_foreign_keys("support_conversations") if fk.get("name")}

    if "ix_support_conversations_assigned_admin_id" in indexes:
        op.drop_index("ix_support_conversations_assigned_admin_id", table_name="support_conversations")

    if "fk_support_conversations_assigned_admin_id_users" in foreign_keys:
        op.drop_constraint(
            "fk_support_conversations_assigned_admin_id_users",
            "support_conversations",
            type_="foreignkey",
        )

    if "assigned_at" in columns:
        op.drop_column("support_conversations", "assigned_at")

    if "assigned_admin_id" in columns:
        op.drop_column("support_conversations", "assigned_admin_id")
