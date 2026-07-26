"""A minimal stand-in for the Supabase client.

Enough of the PostgREST/Storage builder chain to exercise the route logic without a
database. It records what was asked of it so tests can assert on the calls, and
returns whatever rows the test configured per table.

It is not a Postgres emulator: constraints, RLS, and PostgREST's embed shapes are
not modelled. Those need a real database to verify.
"""

from typing import Any


class FakeResponse:
    def __init__(self, data: list[dict[str, Any]] | None):
        self.data = data


class FakeQuery:
    def __init__(self, table: str, calls: list[tuple[str, Any]], rows: list[dict[str, Any]]):
        self._table = table
        self._calls = calls
        self._rows = rows

    def select(self, *args: Any, **kwargs: Any) -> "FakeQuery":
        return self

    def insert(self, payload: dict[str, Any] | list[dict[str, Any]]) -> "FakeQuery":
        self._calls.append(("insert", (self._table, payload)))
        return self

    def update(self, payload: dict[str, Any]) -> "FakeQuery":
        self._calls.append(("update", (self._table, payload)))
        return self

    def upsert(self, payload: dict[str, Any]) -> "FakeQuery":
        self._calls.append(("upsert", (self._table, payload)))
        return self

    def delete(self) -> "FakeQuery":
        self._calls.append(("delete", (self._table,)))
        return self

    def eq(self, column: str, value: Any) -> "FakeQuery":
        self._calls.append(("eq", (self._table, column, value)))
        return self

    def in_(self, column: str, values: list[Any]) -> "FakeQuery":
        self._calls.append(("in_", (self._table, column, values)))
        return self

    def or_(self, expression: str) -> "FakeQuery":
        self._calls.append(("or_", (self._table, expression)))
        return self

    def order(self, column: str, **kwargs: Any) -> "FakeQuery":
        return self

    def range(self, start: int, end: int) -> "FakeQuery":
        self._calls.append(("range", (self._table, start, end)))
        return self

    def limit(self, count: int) -> "FakeQuery":
        return self

    def execute(self) -> FakeResponse:
        return FakeResponse(self._rows)


class FakeBucket:
    def __init__(
        self,
        calls: list[tuple[str, Any]],
        fail_upload: bool = False,
        download_payload: bytes = b"fake audio",
    ):
        self._calls = calls
        self._fail_upload = fail_upload
        self._download_payload = download_payload
        self._fail_remove = False

    def download(self, path: str) -> bytes:
        self._calls.append(("download", (path,)))
        return self._download_payload

    def upload(self, path: str, file: bytes, file_options: dict[str, str] | None = None) -> Any:
        if self._fail_upload:
            raise RuntimeError("storage unavailable")
        self._calls.append(("upload", (path, len(file), file_options)))
        return {"path": path}

    def remove(self, paths: list[str]) -> Any:
        if self._fail_remove:
            raise RuntimeError("storage unavailable")
        self._calls.append(("remove", tuple(paths)))
        return []


class FakeStorage:
    def __init__(
        self,
        calls: list[tuple[str, Any]],
        fail_upload: bool = False,
        download_payload: bytes = b"fake audio",
    ):
        self._calls = calls
        self._fail_upload = fail_upload
        self._download_payload = download_payload
        # Set by tests after construction; read here so it reaches each bucket.
        self._fail_remove = False

    def from_(self, bucket: str) -> FakeBucket:
        self._calls.append(("from_", (bucket,)))
        bucket_stub = FakeBucket(self._calls, self._fail_upload, self._download_payload)
        bucket_stub._fail_remove = self._fail_remove
        return bucket_stub


class FakeSupabase:
    """Configure with ``rows={"tracks": [...]}``; unlisted tables return ``[]``."""

    def __init__(
        self,
        rows: dict[str, list[dict[str, Any]]] | None = None,
        fail_upload: bool = False,
        fail_insert: bool = False,
        fail_rpc: bool = False,
        download_payload: bytes = b"fake audio",
    ):
        self.rows = rows or {}
        self.calls: list[tuple[str, Any]] = []
        self.fail_insert = fail_insert
        self.fail_rpc = fail_rpc
        self.storage = FakeStorage(
            self.calls, fail_upload=fail_upload, download_payload=download_payload
        )

    def table(self, name: str) -> FakeQuery:
        if self.fail_insert and name == "tracks":
            raise RuntimeError("insert failed")
        return FakeQuery(name, self.calls, self.rows.get(name, []))

    def rpc(self, function: str, params: dict[str, Any]) -> FakeQuery:
        self.calls.append(("rpc", (function, params)))
        if self.fail_rpc:
            raise RuntimeError("rpc failed")
        return FakeQuery(function, self.calls, self.rows.get(function, []))

    def calls_named(self, name: str) -> list[Any]:
        return [payload for call, payload in self.calls if call == name]
