"""почта и безопасность учётных записей

Revision ID: 0012_email_security
Revises: 0011_support_chat_assignment
Create Date: 2026-04-26 18:30:00
"""

from alembic import op
import sqlalchemy as sa


revision = "0012_email_security"
down_revision = "0011_support_chat_assignment"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if inspector.has_table("users"):
        user_columns = {column["name"] for column in inspector.get_columns("users")}
        if "email_verified_at" not in user_columns:
            op.add_column("users", sa.Column("email_verified_at", sa.DateTime(timezone=True), nullable=True))
        if "email_verification_deadline_at" not in user_columns:
            op.add_column("users", sa.Column("email_verification_deadline_at", sa.DateTime(timezone=True), nullable=True))
        if "pending_email" not in user_columns:
            op.add_column("users", sa.Column("pending_email", sa.String(length=255), nullable=True))
        if "pending_email_requested_at" not in user_columns:
            op.add_column("users", sa.Column("pending_email_requested_at", sa.DateTime(timezone=True), nullable=True))
        if "pending_email_deadline_at" not in user_columns:
            op.add_column("users", sa.Column("pending_email_deadline_at", sa.DateTime(timezone=True), nullable=True))

    if inspector.has_table("system_settings"):
        setting_columns = {column["name"] for column in inspector.get_columns("system_settings")}
        additions = [
            ("email_enabled", sa.Boolean(), sa.text("false")),
            ("smtp_host", sa.String(length=255), None),
            ("smtp_port", sa.Integer(), sa.text("587")),
            ("smtp_username", sa.String(length=255), None),
            ("smtp_password_encrypted", sa.Text(), None),
            ("smtp_use_tls", sa.Boolean(), sa.text("true")),
            ("smtp_use_ssl", sa.Boolean(), sa.text("false")),
            ("email_from_address", sa.String(length=255), None),
            ("email_from_name", sa.String(length=255), None),
            ("frontend_base_url", sa.String(length=500), None),
            ("email_verification_subject_template", sa.String(length=255), sa.text("'Подтверждение адреса электронной почты'")),
            ("email_verification_body_template", sa.Text(), sa.text("'Здравствуйте, {{full_name}}!\n\nДля подтверждения адреса перейдите по ссылке:\n{{link}}\n\nСсылка действует {{minutes}} минут.'")),
            ("email_change_subject_template", sa.String(length=255), sa.text("'Подтверждение нового адреса электронной почты'")),
            ("email_change_body_template", sa.Text(), sa.text("'Здравствуйте, {{full_name}}!\n\nДля подтверждения нового адреса {{new_email}} перейдите по ссылке:\n{{link}}\n\nСсылка действует {{minutes}} минут.'")),
            ("password_reset_subject_template", sa.String(length=255), sa.text("'Сброс пароля'")),
            ("password_reset_body_template", sa.Text(), sa.text("'Здравствуйте, {{full_name}}!\n\nДля сброса пароля перейдите по ссылке:\n{{link}}\n\nСсылка действует {{minutes}} минут. Если вы не запрашивали сброс пароля, просто проигнорируйте это письмо.'")),
        ]
        for name, column_type, server_default in additions:
            if name not in setting_columns:
                op.add_column("system_settings", sa.Column(name, column_type, nullable=True if server_default is None else False, server_default=server_default))

    if not inspector.has_table("auth_action_tokens"):
        op.create_table(
            "auth_action_tokens",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("action_type", sa.String(length=50), nullable=False),
            sa.Column("token_hash", sa.String(length=128), nullable=False),
            sa.Column("target_email", sa.String(length=255), nullable=True),
            sa.Column("requested_by_ip", sa.String(length=64), nullable=True),
            sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        )
        op.create_index("ix_auth_action_tokens_user_id", "auth_action_tokens", ["user_id"], unique=False)
        op.create_index("ix_auth_action_tokens_action_type", "auth_action_tokens", ["action_type"], unique=False)
        op.create_index("ix_auth_action_tokens_expires_at", "auth_action_tokens", ["expires_at"], unique=False)
        op.create_index("ix_auth_action_tokens_token_hash", "auth_action_tokens", ["token_hash"], unique=True)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if inspector.has_table("auth_action_tokens"):
        indexes = {index["name"] for index in inspector.get_indexes("auth_action_tokens") if index.get("name")}
        for index_name in (
            "ix_auth_action_tokens_token_hash",
            "ix_auth_action_tokens_expires_at",
            "ix_auth_action_tokens_action_type",
            "ix_auth_action_tokens_user_id",
        ):
            if index_name in indexes:
                op.drop_index(index_name, table_name="auth_action_tokens")
        op.drop_table("auth_action_tokens")

    if inspector.has_table("system_settings"):
        setting_columns = {column["name"] for column in inspector.get_columns("system_settings")}
        for name in (
            "password_reset_body_template",
            "password_reset_subject_template",
            "email_change_body_template",
            "email_change_subject_template",
            "email_verification_body_template",
            "email_verification_subject_template",
            "frontend_base_url",
            "email_from_name",
            "email_from_address",
            "smtp_use_ssl",
            "smtp_use_tls",
            "smtp_password_encrypted",
            "smtp_username",
            "smtp_port",
            "smtp_host",
            "email_enabled",
        ):
            if name in setting_columns:
                op.drop_column("system_settings", name)

    if inspector.has_table("users"):
        user_columns = {column["name"] for column in inspector.get_columns("users")}
        for name in (
            "pending_email_deadline_at",
            "pending_email_requested_at",
            "pending_email",
            "email_verification_deadline_at",
            "email_verified_at",
        ):
            if name in user_columns:
                op.drop_column("users", name)
