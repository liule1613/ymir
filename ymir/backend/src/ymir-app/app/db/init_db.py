import json

from sqlalchemy.orm import Session

from app import crud, schemas
from app.config import settings
from app.constants.role import Roles
from app.db import base  # noqa: F401
from app.utils.security import frontend_hash
from app.utils.ymir_controller import ControllerClient

# make sure all SQL Alchemy models are imported (app.db.base) before initializing DB
# otherwise, SQL Alchemy might fail to initialize relationships properly
# for more details: https://github.com/tiangolo/full-stack-fastapi-postgresql/issues/28


def init_db(db: Session) -> None:
    # Tables should be created with Alembic migrations
    # But if you don't want to use migrations, create
    # the tables un-commenting the next line
    # Base.metadata.create_all(bind=engine)
    roles = crud.role.get_multi(db)
    if not roles:
        for role in [Roles.NORMAL, Roles.ADMIN, Roles.SUPER_ADMIN]:
            role_in = schemas.RoleCreate(name=role.name, description=role.description)
            crud.role.create(db, obj_in=role_in)

    user = crud.user.get_by_email(db, email=settings.FIRST_ADMIN)
    if not user:
        password = frontend_hash(settings.FIRST_ADMIN_PASSWORD)
        user_in = schemas.UserCreate(
            email=settings.FIRST_ADMIN,
            password=password,
        )
        user = crud.user.create(db, obj_in=user_in)  # noqa: F841
        user = crud.user.activate(db, user=user)
        user = crud.user.update_role(db, user=user, role=schemas.UserRole.SUPER_ADMIN)

    workspace = crud.workspace.get_by_user_id(db, user_id=user.id)
    if not workspace:
        workspace_in = schemas.WorkspaceCreate(user_id=user.id)
        workspace = crud.workspace.create(db, obj_in=workspace_in)
        if settings.INIT_SANDBOX_FOR_FIRST_USER:
            # Ask controller to setup sandbox for initial user
            controller = ControllerClient(settings.GRPC_CHANNEL)
            controller.create_workspace(
                user_id=workspace.user_id, workspace_id=workspace.hash
            )

    docker_images = crud.docker_image.get_multi(db)
    if not docker_images and settings.RUNTIMES:
        runtime_configs = json.loads(settings.RUNTIMES)
        for config in runtime_configs:
            docker_image_in = schemas.DockerImageCreate(**config)
            docker_image = crud.docker_image.create(
                db, obj_in=docker_image_in
            )  # noqa: F841
            crud.docker_image.update_state(
                db, docker_image=docker_image, state=schemas.DockerImageState.done
            )

            image_config_in = schemas.ImageConfigCreate(
                image_id=docker_image.id,
                config=config["config"],
                type=int(config["type"]),
            )
            crud.image_config.create(db, obj_in=image_config_in)
