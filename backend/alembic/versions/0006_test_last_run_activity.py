"""add last run activity to tests"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0006_test_last_run_activity"
down_revision: Union[str, None] = "0005_test_run_counters"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("tests", sa.Column("last_run_activity", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("tests", "last_run_activity")