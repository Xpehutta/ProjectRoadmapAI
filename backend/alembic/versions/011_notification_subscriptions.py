"""Подписки на email-уведомления по проекту."""

from alembic import op
import sqlalchemy as sa

revision = "011"
down_revision = "010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "notification_subscriptions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("display_name", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("project_id", "email", name="uq_notification_project_email"),
    )
    op.create_index(
        "ix_notification_subscriptions_project_id",
        "notification_subscriptions",
        ["project_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_notification_subscriptions_project_id", table_name="notification_subscriptions")
    op.drop_table("notification_subscriptions")
