"""Detected signals, frozen from the strategy that produced them."""

from alembic import op
import sqlalchemy as sa

revision = "9f2b5a1d7c44"
down_revision = "b721a8c03e12"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "signals",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "user_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "strategy_id",
            sa.String(36),
            sa.ForeignKey("strategies.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "symbol", sa.String(20), sa.ForeignKey("assets.symbol"), nullable=False
        ),
        sa.Column("date", sa.String(10), nullable=False),
        sa.Column("price", sa.Float(), nullable=False),
        sa.Column("side", sa.String(8), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("strategy_snapshot", sa.JSON(), nullable=False),
        sa.Column("indicators", sa.JSON(), nullable=False),
        sa.Column("conditions", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.Float(), nullable=False),
    )
    op.create_index("ix_signals_user_id", "signals", ["user_id"])
    op.create_index("ix_signals_strategy_id", "signals", ["strategy_id"])
    op.create_index("ix_signals_symbol", "signals", ["symbol"])
    op.create_index("ix_signals_created_at", "signals", ["created_at"])


def downgrade():
    op.drop_index("ix_signals_created_at", table_name="signals")
    op.drop_index("ix_signals_symbol", table_name="signals")
    op.drop_index("ix_signals_strategy_id", table_name="signals")
    op.drop_index("ix_signals_user_id", table_name="signals")
    op.drop_table("signals")
