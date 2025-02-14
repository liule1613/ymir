from typing import Dict

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app import crud
from app.config import settings
from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate
from app.schemas.workspace import WorkspaceCreate
from tests.utils.utils import random_email, random_lower_string


def user_authentication_headers(
    *, client: TestClient, email: str, password: str
) -> Dict[str, str]:
    data = {"username": email, "password": password}

    r = client.post(f"{settings.API_V1_STR}/auth/token", data=data)
    response = r.json()["result"]
    auth_token = response["access_token"]
    headers = {"Authorization": f"Bearer {auth_token}"}
    return headers


def create_random_user(db: Session) -> User:
    email = random_email()
    password = random_lower_string()
    user_in = UserCreate(username=email, email=email, password=password)
    user = crud.user.create(db=db, obj_in=user_in)
    user = crud.user.activate(db=db, user=user)
    return user


def authentication_token_from_email(
    *, client: TestClient, email: str, db: Session
) -> Dict[str, str]:
    """
    Return a valid token for the user with given email.

    If the user doesn't exist it is created first.
    """
    password = random_lower_string()
    user = crud.user.get_by_email(db, email=email)
    if not user:
        user_in_create = UserCreate(username=email, email=email, password=password)
        user = crud.user.create(db, obj_in=user_in_create)
    else:
        user_in_update = UserUpdate(email=email, password=password)
        user = crud.user.update(db, db_obj=user, obj_in=user_in_update)
    user = crud.user.activate(db, user=user)
    workspace = crud.workspace.get_by_user_id(db, user_id=user.id)
    if not workspace:
        workspace_in = WorkspaceCreate(
            hash=f"{user.id:0>6}",
            name=f"{user.id:0>6}",
            user_id=user.id,
        )
        workspace = crud.workspace.create(db, obj_in=workspace_in)  # noqa: F841
    return user_authentication_headers(client=client, email=email, password=password)
