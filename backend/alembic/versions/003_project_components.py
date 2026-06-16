"""reusable project components

Revision ID: 003
Revises: 002
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import ENUM

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

taskstatus_enum = ENUM(
    "todo",
    "in_progress",
    "done",
    "blocked",
    name="taskstatus",
    create_type=False,
)


def upgrade() -> None:
    op.create_table(
        "project_components",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("data_source", sa.String(length=255), nullable=False),
        sa.Column("assignee", sa.String(length=255), nullable=True),
        sa.Column("status", taskstatus_enum, nullable=False),
        sa.Column("completion_pct", sa.Integer(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=True),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("duration_days", sa.Integer(), nullable=True),
        sa.Column("indicative_start", sa.Date(), nullable=True),
        sa.Column("indicative_end", sa.Date(), nullable=True),
        sa.Column("contractor", sa.String(length=255), nullable=True),
        sa.Column("platform", sa.String(length=255), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("project_id", "data_source", name="uq_component_project_source"),
    )
    op.create_index("ix_project_components_project_id", "project_components", ["project_id"])

    op.create_table(
        "component_sub_stages",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("component_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("is_done", sa.Boolean(), nullable=False),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("is_indicative", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.ForeignKeyConstraint(["component_id"], ["project_components.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_component_sub_stages_component_id", "component_sub_stages", ["component_id"])

    op.add_column("tasks", sa.Column("component_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_tasks_component_id",
        "tasks",
        "project_components",
        ["component_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_tasks_component_id", "tasks", ["component_id"])


def downgrade() -> None:
    op.drop_index("ix_tasks_component_id", table_name="tasks")
    op.drop_constraint("fk_tasks_component_id", "tasks", type_="foreignkey")
    op.drop_column("tasks", "component_id")
    op.drop_index("ix_component_sub_stages_component_id", table_name="component_sub_stages")
    op.drop_table("component_sub_stages")
    op.drop_index("ix_project_components_project_id", table_name="project_components")
    op.drop_table("project_components")
