"""Combo logging routes.

Empty by design — build spec §7 step 6 fills this in. Planned surface (§5):

    POST   /combos        log a combo (track_a, track_b, technique, rating, notes)
    GET    /combos        list logged combos
"""

from fastapi import APIRouter

router = APIRouter(prefix="/combos", tags=["combos"])
