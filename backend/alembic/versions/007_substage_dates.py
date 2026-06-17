"""sub-stage start and end dates

Revision ID: 007
Revises: 006
"""

from alembic import op
import sqlalchemy as sa

revision = "007"
down_revision = "006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    for table in ("task_sub_stages", "component_sub_stages"):
        op.add_column(table, sa.Column("start_date", sa.Date(), nullable=True))
        op.add_column(table, sa.Column("end_date", sa.Date(), nullable=True))
    op.execute(
        "UPDATE task_sub_stages SET end_date = due_date WHERE due_date IS NOT NULL AND end_date IS NULL"
    )
    op.execute(
        "UPDATE component_sub_stages SET end_date = due_date WHERE due_date IS NOT NULL AND end_date IS NULL"
    )


def downgrade() -> None:
    for table in ("task_sub_stages", "component_sub_stages"):
        op.drop_column(table, "end_date")
        op.drop_column(table, "start_date")
