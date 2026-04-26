"""обновление схемы чатов поддержки

Revision ID: 0010_support_chat_update
Revises: 0009_support_chat
Create Date: 2026-04-23 12:40:00
"""

from alembic import op
import sqlalchemy as sa


revision = "0010_support_chat_update"
down_revision = "0009_support_chat"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not inspector.has_table("support_conversations"):
        return

    columns = {column["name"] for column in inspector.get_columns("support_conversations")}
    unique_constraints = {
        constraint["name"]
        for constraint in inspector.get_unique_constraints("support_conversations")
        if constraint.get("name")
    }
    indexes = {
        index["name"]
        for index in inspector.get_indexes("support_conversations")
        if index.get("name")
    }

    if "closed_at" not in columns:
        op.add_column(
            "support_conversations",
            sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        )

    if "uq_support_conversations_user_id" in unique_constraints:
        op.drop_constraint(
            "uq_support_conversations_user_id",
            "support_conversations",
            type_="unique",
        )

    if "uq_support_conversations_one_open_per_user" not in indexes:
        op.execute(
            """
            CREATE UNIQUE INDEX uq_support_conversations_one_open_per_user
            ON support_conversations (user_id)
            WHERE status = 'open'
            """
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not inspector.has_table("support_conversations"):
        return

    indexes = {
        index["name"]
        for index in inspector.get_indexes("support_conversations")
        if index.get("name")
    }
    unique_constraints = {
        constraint["name"]
        for constraint in inspector.get_unique_constraints("support_conversations")
        if constraint.get("name")
    }
    columns = {column["name"] for column in inspector.get_columns("support_conversations")}

    if "uq_support_conversations_one_open_per_user" in indexes:
        op.drop_index("uq_support_conversations_one_open_per_user", table_name="support_conversations")

    if "uq_support_conversations_user_id" not in unique_constraints:
        op.create_unique_constraint(
            "uq_support_conversations_user_id",
            "support_conversations",
            ["user_id"],
        )

    if "closed_at" in columns:
        op.drop_column("support_conversations", "closed_at")