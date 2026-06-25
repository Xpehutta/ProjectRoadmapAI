"""Поля связи проекта с Epic в Jira."""

from alembic import op
import sqlalchemy as sa

revision = "012"
down_revision = "011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("projects", sa.Column("jira_epic_key", sa.String(length=64), nullable=True))
    op.add_column("projects", sa.Column("jira_epic_url", sa.String(length=512), nullable=True))


def downgrade() -> None:
    op.drop_column("projects", "jira_epic_url")
    op.drop_column("projects", "jira_epic_key")
