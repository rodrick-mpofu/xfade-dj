"""Session / setlist routes.

Empty by design — build spec §7 step 6 fills this in. Planned surface (§5):

    POST   /sessions              create a session
    GET    /sessions              list sessions
    POST   /sessions/{id}/tracks  add / reorder tracks in a setlist
"""

from fastapi import APIRouter

router = APIRouter(prefix="/sessions", tags=["sessions"])
