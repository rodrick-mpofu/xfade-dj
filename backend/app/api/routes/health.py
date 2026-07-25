"""Liveness and dependency checks."""

from fastapi import APIRouter, HTTPException, status

from app.config import get_settings
from app.db.supabase import get_service_client

router = APIRouter(prefix="/health", tags=["health"])


@router.get("", summary="Liveness check")
def health() -> dict[str, str]:
    settings = get_settings()
    return {
        "status": "ok",
        "service": settings.app_name,
        "version": settings.version,
        "environment": settings.environment,
    }


@router.get("/db", summary="Supabase connectivity check")
def health_db() -> dict[str, str]:
    """Round-trip to Postgres. Service-role, so this reports reachability rather
    than whether any particular user can see rows."""
    try:
        get_service_client().table("tracks").select("id").limit(1).execute()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Supabase unreachable: {exc}",
        ) from exc
    return {"status": "ok", "database": "reachable"}
