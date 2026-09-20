"""Private strategy definitions."""

from alembic import op
import sqlalchemy as sa

revision = "b721a8c03e12"
down_revision = "da146052b48e"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "strategies",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "user_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(80), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False),
        sa.Column("definition", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.Float(), nullable=False),
    )
    op.create_index("ix_strategies_user_id", "strategies", ["user_id"])


def downgrade():
    op.drop_index("ix_strategies_user_id", table_name="strategies")
    op.drop_table("strategies")
