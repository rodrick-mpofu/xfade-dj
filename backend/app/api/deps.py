"""Shared FastAPI dependencies: auth, and the request-scoped Supabase client.

The Supabase-side blocking calls live in plain ``def`` dependencies so FastAPI runs
them in a threadpool rather than stalling the event loop.
"""

from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from supabase import Client

from app.db.supabase import get_anon_client, get_user_client

_bearer = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class CurrentUser:
    id: str
    email: str | None
    access_token: str


def get_access_token(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> str:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return credentials.credentials


def get_current_user(token: Annotated[str, Depends(get_access_token)]) -> CurrentUser:
    """Resolve the Supabase Auth user behind the bearer token."""
    try:
        response = get_anon_client().auth.get_user(token)
    except Exception as exc:  # supabase raises AuthApiError subclasses on bad/expired tokens
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    if response is None or response.user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return CurrentUser(id=response.user.id, email=response.user.email, access_token=token)


def get_db(user: Annotated[CurrentUser, Depends(get_current_user)]) -> Client:
    """Supabase client scoped to the caller, with RLS in force."""
    return get_user_client(user.access_token)


CurrentUserDep = Annotated[CurrentUser, Depends(get_current_user)]
DbDep = Annotated[Client, Depends(get_db)]
