"""watering group id

Revision ID: b7a542cfbcac
Revises: 7ebca76fd98e
Create Date: 2026-09-21 12:39:01.844707

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b7a542cfbcac'
down_revision: Union[str, Sequence[str], None] = '7ebca76fd98e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add nullable first, backfill (each existing row is its own event), then set NOT NULL
    op.add_column('watering_history', sa.Column('group_id', sa.UUID(), nullable=True))
    op.execute("UPDATE watering_history SET group_id = id WHERE group_id IS NULL")
    op.alter_column('watering_history', 'group_id', nullable=False)
    op.create_index(op.f('ix_watering_history_group_id'), 'watering_history', ['group_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_watering_history_group_id'), table_name='watering_history')
    op.drop_column('watering_history', 'group_id')
