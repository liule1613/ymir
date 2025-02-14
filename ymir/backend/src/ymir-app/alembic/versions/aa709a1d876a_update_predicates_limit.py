"""update predicates limit

Revision ID: aa709a1d876a
Revises: 5068aee30aed
Create Date: 2021-10-25 15:38:58.526535

"""
import sqlalchemy as sa

from alembic import context, op

# revision identifiers, used by Alembic.
revision = "aa709a1d876a"
down_revision = "5068aee30aed"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    if context.get_x_argument(as_dictionary=True).get("sqlite", None):
        with op.batch_alter_table("dataset") as batch_op:
            batch_op.drop_column("predicates")
            batch_op.add_column(sa.Column("predicates", sa.Text(20000), nullable=True))
    else:
        op.alter_column(
            "dataset",
            "predicates",
            existing_type=sa.String(length=500),
            type_=sa.Text(20000),
            existing_nullable=True,
        )
    # ### end Alembic commands ###


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    if context.get_x_argument(as_dictionary=True).get("sqlite", None):
        with op.batch_alter_table("dataset") as batch_op:
            batch_op.drop_column("predicates")
            batch_op.add_column(
                sa.Column("predicates", sa.String(length=500), nullable=True)
            )
    else:
        op.alter_column(
            "dataset",
            "predicates",
            existing_type=sa.Text(20000),
            type_=sa.String(length=500),
            existing_nullable=True,
        )
    # ### end Alembic commands ###
