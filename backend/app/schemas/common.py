"""Shared field types."""

from typing import Annotated

from pydantic import AfterValidator, Field


def _non_blank(value: str) -> str:
    """Strip, then reject what is left if it is empty.

    `min_length=1` alone lets "   " through, which then trips the database's
    `length(trim(...)) > 0` check and surfaces as a 500 instead of a 422.
    """
    stripped = value.strip()
    if not stripped:
        raise ValueError("must not be blank")
    return stripped


def non_blank(max_length: int) -> object:
    """A required, whitespace-trimmed, non-empty string field."""
    return Annotated[str, Field(max_length=max_length), AfterValidator(_non_blank)]


NonBlankTitle = non_blank(300)
NonBlankName = non_blank(200)
