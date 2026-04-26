"""create support chat tables

Revision ID: 0009_support_chat
Revises: 0008_test_run_thresholds
Create Date: 2026-04-23 00:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = "0009_support_chat"
down_revision = "0008_test_run_thresholds"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not inspector.has_table("support_conversations"):
        op.create_table(
            "support_conversations",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("status", sa.String(length=20), nullable=False, server_default="open"),
            sa.Column("last_message_preview", sa.Text(), nullable=True),
            sa.Column("unread_for_admin", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("unread_for_user", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("last_message_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        )
        op.create_index("ix_support_conversations_user_id", "support_conversations", ["user_id"], unique=False)
        op.execute(
            """
            CREATE UNIQUE INDEX uq_support_conversations_one_open_per_user
            ON support_conversations (user_id)
            WHERE status = 'open'
            """
        )

    if not inspector.has_table("support_messages"):
        op.create_table(
            "support_messages",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("conversation_id", sa.Integer(), sa.ForeignKey("support_conversations.id", ondelete="CASCADE"), nullable=False),
            sa.Column("author_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("is_from_admin", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("text", sa.Text(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        )
        op.create_index("ix_support_messages_conversation_id", "support_messages", ["conversation_id"], unique=False)
        op.create_index("ix_support_messages_author_id", "support_messages", ["author_id"], unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if inspector.has_table("support_messages"):
        indexes = {index["name"] for index in inspector.get_indexes("support_messages")}
        if "ix_support_messages_author_id" in indexes:
            op.drop_index("ix_support_messages_author_id", table_name="support_messages")
        if "ix_support_messages_conversation_id" in indexes:
            op.drop_index("ix_support_messages_conversation_id", table_name="support_messages")
        op.drop_table("support_messages")

    if inspector.has_table("support_conversations"):
        indexes = {index["name"] for index in inspector.get_indexes("support_conversations")}
        if "uq_support_conversations_one_open_per_user" in indexes:
            op.drop_index("uq_support_conversations_one_open_per_user", table_name="support_conversations")
        if "ix_support_conversations_user_id" in indexes:
            op.drop_index("ix_support_conversations_user_id", table_name="support_conversations")
        op.drop_table("support_conversations")
