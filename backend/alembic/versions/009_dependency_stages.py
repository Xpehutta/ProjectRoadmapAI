"""Add optional stage endpoints to task dependencies."""

from alembic import op
import sqlalchemy as sa

revision = "009"
down_revision = "008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("dependencies", sa.Column("predecessor_stage_id", sa.Integer(), nullable=True))
    op.add_column("dependencies", sa.Column("successor_stage_id", sa.Integer(), nullable=True))
    op.drop_constraint("uq_dependency", "dependencies", type_="unique")
    op.create_unique_constraint(
        "uq_dependency_pair",
        "dependencies",
        ["predecessor_id", "successor_id", "predecessor_stage_id", "successor_stage_id"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_dependency_pair", "dependencies", type_="unique")
    op.create_unique_constraint("uq_dependency", "dependencies", ["predecessor_id", "successor_id"])
    op.drop_column("dependencies", "successor_stage_id")
    op.drop_column("dependencies", "predecessor_stage_id")
