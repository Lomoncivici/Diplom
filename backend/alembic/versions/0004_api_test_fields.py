"""add api fields to tests"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0004_api_fields"
down_revision: Union[str, None] = "0003_tests"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("tests", sa.Column("request_method", sa.String(length=16), nullable=False, server_default="GET"))
    op.add_column("tests", sa.Column("request_path", sa.String(length=500), nullable=True))
    op.add_column("tests", sa.Column("request_headers", sa.JSON(), nullable=True))
    op.add_column("tests", sa.Column("query_params", sa.JSON(), nullable=True))
    op.add_column("tests", sa.Column("request_body", sa.JSON(), nullable=True))
    op.add_column("tests", sa.Column("expected_status_code", sa.Integer(), nullable=True))
    op.add_column("tests", sa.Column("expected_response_time_ms", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("tests", "expected_response_time_ms")
    op.drop_column("tests", "expected_status_code")
    op.drop_column("tests", "request_body")
    op.drop_column("tests", "query_params")
    op.drop_column("tests", "request_headers")
    op.drop_column("tests", "request_path")
    op.drop_column("tests", "request_method")