"""releases, goals, and prioritization fields

Revision ID: 004
Revises: 003
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ENUM

revision = "004"
down_revision = "003"
branch_labels = None
depends_on = None

moscow_enum = ENUM("must", "should", "could", "wont", name="moscow", create_type=False)
release_status_enum = ENUM(
    "planned", "in_progress", "released", name="releasestatus", create_type=False
)


def upgrade() -> None:
    release_status_enum.create(op.get_bind(), checkfirst=True)
    moscow_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "releases",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("target_date", sa.Date(), nullable=True),
        sa.Column("status", release_status_enum, nullable=False, server_default="planned"),
        sa.Column("color", sa.String(7), nullable=False, server_default="#6366f1"),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("description", sa.Text(), nullable=True),
    )
    op.create_index("ix_releases_project_id", "releases", ["project_id"])

    op.create_table(
        "goals",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("color", sa.String(7), nullable=False, server_default="#059669"),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_index("ix_goals_project_id", "goals", ["project_id"])

    op.add_column("tasks", sa.Column("release_id", sa.Integer(), sa.ForeignKey("releases.id", ondelete="SET NULL"), nullable=True))
    op.add_column("tasks", sa.Column("goal_id", sa.Integer(), sa.ForeignKey("goals.id", ondelete="SET NULL"), nullable=True))
    op.add_column("tasks", sa.Column("moscow", moscow_enum, nullable=True))
    op.add_column("tasks", sa.Column("rice_reach", sa.Integer(), nullable=True))
    op.add_column("tasks", sa.Column("rice_impact", sa.Integer(), nullable=True))
    op.add_column("tasks", sa.Column("rice_confidence", sa.Integer(), nullable=True))
    op.add_column("tasks", sa.Column("rice_effort", sa.Integer(), nullable=True))
    op.add_column("tasks", sa.Column("value_score", sa.Integer(), nullable=True))
    op.add_column("tasks", sa.Column("effort_score", sa.Integer(), nullable=True))
    op.create_index("ix_tasks_release_id", "tasks", ["release_id"])
    op.create_index("ix_tasks_goal_id", "tasks", ["goal_id"])


def downgrade() -> None:
    op.drop_index("ix_tasks_goal_id", "tasks")
    op.drop_index("ix_tasks_release_id", "tasks")
    for col in (
        "effort_score",
        "value_score",
        "rice_effort",
        "rice_confidence",
        "rice_impact",
        "rice_reach",
        "moscow",
        "goal_id",
        "release_id",
    ):
        op.drop_column("tasks", col)
    op.drop_index("ix_goals_project_id", "goals")
    op.drop_table("goals")
    op.drop_index("ix_releases_project_id", "releases")
    op.drop_table("releases")
    moscow_enum.drop(op.get_bind(), checkfirst=True)
    release_status_enum.drop(op.get_bind(), checkfirst=True)
