"""Supabase client factories.

Two access paths, deliberately separate:

* :func:`get_user_client` — carries the caller's JWT, so every query runs under the
  RLS policies in ``supabase/migrations``. This is the default for anything serving
  a request.
* :func:`get_service_client` — service-role key, bypasses RLS. Reserved for the
  background extraction job, which writes ``audio_features`` with no request context
  and therefore no user JWT to borrow.

Reaching for the service client inside a request handler silently disables the
authorization model, so it should stay out of ``app/api/routes``.
"""

from functools import lru_cache

from supabase import Client, ClientOptions, create_client

from app.config import get_settings

_BASE_OPTIONS = {
    # Nothing here is a long-lived session; the client is per-request or per-job.
    "auto_refresh_token": False,
    "persist_session": False,
}


@lru_cache
def get_anon_client() -> Client:
    """Unauthenticated client. Used to verify bearer tokens, not to read data."""
    settings = get_settings()
    return create_client(
        settings.supabase_url,
        settings.supabase_anon_key,
        options=ClientOptions(**_BASE_OPTIONS),
    )


@lru_cache
def get_service_client() -> Client:
    """RLS-bypassing client. Extraction job only — see module docstring."""
    settings = get_settings()
    return create_client(
        settings.supabase_url,
        settings.supabase_service_role_key,
        options=ClientOptions(**_BASE_OPTIONS),
    )


def get_user_client(access_token: str) -> Client:
    """Client acting as the caller, with RLS enforced.

    Not cached: each request gets a client bound to that request's token.
    """
    settings = get_settings()
    return create_client(
        settings.supabase_url,
        settings.supabase_anon_key,
        options=ClientOptions(
            headers={"Authorization": f"Bearer {access_token}"},
            **_BASE_OPTIONS,
        ),
    )
