"""flexible table schema and custom task fields

Revision ID: 005
Revises: 004
"""

from alembic import op
import sqlalchemy as sa

revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("projects", sa.Column("table_schema", sa.JSON(), nullable=True))
    op.add_column("tasks", sa.Column("custom_fields", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("tasks", "custom_fields")
    op.drop_column("projects", "table_schema")
