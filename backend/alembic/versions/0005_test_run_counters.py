from alembic import op
import sqlalchemy as sa

revision = "0005_test_run_counters"
down_revision = "0004_api_fields"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("test_runs", sa.Column("requests_total", sa.Integer(), nullable=True))
    op.add_column("test_runs", sa.Column("requests_success", sa.Integer(), nullable=True))
    op.add_column("test_runs", sa.Column("requests_failed", sa.Integer(), nullable=True))


def downgrade():
    op.drop_column("test_runs", "requests_failed")
    op.drop_column("test_runs", "requests_success")
    op.drop_column("test_runs", "requests_total")