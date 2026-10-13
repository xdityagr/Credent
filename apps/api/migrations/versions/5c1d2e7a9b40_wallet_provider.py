"""wallet provider name

Revision ID: 5c1d2e7a9b40
Revises: 3a850f06ef3f
Create Date: 2026-10-13 09:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '5c1d2e7a9b40'
down_revision: Union[str, Sequence[str], None] = '3a850f06ef3f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('wallet', schema=None) as batch_op:
        batch_op.add_column(sa.Column('provider', sa.String(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('wallet', schema=None) as batch_op:
        batch_op.drop_column('provider')
