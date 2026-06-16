"""datamarts spreadsheet fields

Revision ID: 002
Revises: 001
Create Date: 2026-06-15
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("tasks", sa.Column("priority", sa.Integer(), nullable=True))
    op.add_column("tasks", sa.Column("subproduct", sa.String(length=255), nullable=True))
    op.add_column("tasks", sa.Column("forms", sa.Text(), nullable=True))
    op.add_column("tasks", sa.Column("customer", sa.Text(), nullable=True))
    op.add_column("tasks", sa.Column("data_source", sa.Text(), nullable=True))
    op.add_column("tasks", sa.Column("platform", sa.String(length=255), nullable=True))
    op.add_column("tasks", sa.Column("area", sa.String(length=255), nullable=True))
    op.add_column("tasks", sa.Column("contractor", sa.String(length=255), nullable=True))
    op.add_column("tasks", sa.Column("desired_quarter", sa.String(length=32), nullable=True))
    op.add_column("tasks", sa.Column("attribute_count", sa.String(length=64), nullable=True))
    op.add_column("tasks", sa.Column("risks", sa.Text(), nullable=True))
    op.add_column("tasks", sa.Column("notes", sa.Text(), nullable=True))
    op.add_column("tasks", sa.Column("extra_info", sa.Text(), nullable=True))

    op.add_column("task_sub_stages", sa.Column("due_date", sa.Date(), nullable=True))
    op.add_column("task_sub_stages", sa.Column("note", sa.Text(), nullable=True))
    op.add_column(
        "task_sub_stages",
        sa.Column("is_indicative", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column("task_sub_stages", "is_indicative")
    op.drop_column("task_sub_stages", "note")
    op.drop_column("task_sub_stages", "due_date")
    for col in (
        "extra_info",
        "notes",
        "risks",
        "attribute_count",
        "desired_quarter",
        "contractor",
        "area",
        "platform",
        "data_source",
        "customer",
        "forms",
        "subproduct",
        "priority",
    ):
        op.drop_column("tasks", col)
