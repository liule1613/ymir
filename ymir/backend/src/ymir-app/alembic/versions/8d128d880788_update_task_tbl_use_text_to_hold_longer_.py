"""update task tbl: use Text to hold longer string

Revision ID: 8d128d880788
Revises: 01d657267139
Create Date: 2021-12-06 16:04:13.216251

"""
import sqlalchemy as sa

from alembic import context, op

# revision identifiers, used by Alembic.
revision = "8d128d880788"
down_revision = "01d657267139"
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    if context.get_x_argument(as_dictionary=True).get("sqlite", None):
        with op.batch_alter_table("task") as batch_op:
            batch_op.alter_column(
                "parameters",
                existing_type=sa.VARCHAR(length=500),
                type_=sa.Text(length=500),
                existing_nullable=True,
            )
            batch_op.alter_column(
                "config",
                existing_type=sa.VARCHAR(length=500),
                type_=sa.Text(length=500),
                existing_nullable=True,
            )
    else:
        op.alter_column(
            "task",
            "parameters",
            existing_type=sa.VARCHAR(length=500),
            type_=sa.Text(length=500),
            existing_nullable=True,
        )
        op.alter_column(
            "task",
            "config",
            existing_type=sa.VARCHAR(length=500),
            type_=sa.Text(length=500),
            existing_nullable=True,
        )
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    if context.get_x_argument(as_dictionary=True).get("sqlite", None):
        with op.batch_alter_table("task") as batch_op:
            batch_op.alter_column(
                "config",
                existing_type=sa.Text(length=500),
                type_=sa.VARCHAR(length=500),
                existing_nullable=True,
            )
            batch_op.alter_column(
                "parameters",
                existing_type=sa.Text(length=500),
                type_=sa.VARCHAR(length=500),
                existing_nullable=True,
            )
    else:
        op.alter_column(
            "task",
            "config",
            existing_type=sa.Text(length=500),
            type_=sa.VARCHAR(length=500),
            existing_nullable=True,
        )
        op.alter_column(
            "task",
            "parameters",
            existing_type=sa.Text(length=500),
            type_=sa.VARCHAR(length=500),
            existing_nullable=True,
        )
    # ### end Alembic commands ###
