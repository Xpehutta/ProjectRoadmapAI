"""Add internal_stage_links JSON for typed stage dependencies within a task."""

from alembic import op
import sqlalchemy as sa

revision = "010"
down_revision = "009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("tasks", sa.Column("internal_stage_links", sa.JSON(), nullable=True))
    op.add_column("project_components", sa.Column("internal_stage_links", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("project_components", "internal_stage_links")
    op.drop_column("tasks", "internal_stage_links")
