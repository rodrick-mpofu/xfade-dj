"""Track library routes.

Empty by design — build spec §7 step 3 fills this in. Planned surface (§5):

    POST   /tracks        upload audio -> Storage, row -> tracks, queue extraction
    GET    /tracks        list library
    GET    /tracks/{id}   detail, including audio_features and extraction status

Handlers take ``DbDep`` from ``app.api.deps`` so queries run under the caller's RLS.
"""

from fastapi import APIRouter

router = APIRouter(prefix="/tracks", tags=["tracks"])
