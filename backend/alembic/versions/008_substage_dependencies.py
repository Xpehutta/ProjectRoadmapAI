"""Add predecessor_stage_ids to task and component sub-stages."""

from alembic import op
import sqlalchemy as sa

revision = "008"
down_revision = "007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("task_sub_stages", sa.Column("predecessor_stage_ids", sa.JSON(), nullable=True))
    op.add_column("component_sub_stages", sa.Column("predecessor_stage_ids", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("component_sub_stages", "predecessor_stage_ids")
    op.drop_column("task_sub_stages", "predecessor_stage_ids")
