from __future__ import annotations

from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from threading import RLock


DEFAULT_TECHNICAL_WORKS_MESSAGE = "Сейчас идут технические работы. Платформа может работать нестабильно."
DEFAULT_NOTICE_SECONDS = 15


@dataclass
class PlatformStatusSnapshot:
    technical_works_active: bool
    technical_works_message: str | None
    current_operation: str | None
    started_at: datetime | None


class PlatformStatusService:
    def __init__(self) -> None:
        self._lock = RLock()
        self._technical_works_active = False
        self._technical_works_message: str | None = None
        self._current_operation: str | None = None
        self._started_at: datetime | None = None
        self._notice_until: datetime | None = None
        self._last_auto_backup_path: str | None = None
        self._last_auto_backup_name: str | None = None

    def get_snapshot(self) -> PlatformStatusSnapshot:
        with self._lock:
            now = datetime.now(timezone.utc)
            active_by_time = self._notice_until is not None and now < self._notice_until
            is_active = self._technical_works_active or active_by_time
            if not is_active:
                self._technical_works_message = None
                self._current_operation = None
                self._started_at = None
                self._notice_until = None

            return PlatformStatusSnapshot(
                technical_works_active=is_active,
                technical_works_message=self._technical_works_message,
                current_operation=self._current_operation,
                started_at=self._started_at,
            )

    def get_last_auto_backup(self) -> tuple[str | None, str | None]:
        with self._lock:
            return self._last_auto_backup_path, self._last_auto_backup_name

    def set_last_auto_backup(self, path: str, file_name: str) -> None:
        with self._lock:
            self._last_auto_backup_path = path
            self._last_auto_backup_name = file_name

    def activate_technical_works(self, operation: str, message: str = DEFAULT_TECHNICAL_WORKS_MESSAGE) -> None:
        with self._lock:
            self._technical_works_active = True
            self._technical_works_message = message
            self._current_operation = operation
            self._started_at = datetime.now(timezone.utc)
            self._notice_until = None

    def deactivate_technical_works(self, notice_seconds: int = DEFAULT_NOTICE_SECONDS) -> None:
        with self._lock:
            self._technical_works_active = False
            self._notice_until = datetime.now(timezone.utc) + timedelta(seconds=max(0, int(notice_seconds)))

    @contextmanager
    def technical_works(self, operation: str, message: str = DEFAULT_TECHNICAL_WORKS_MESSAGE, notice_seconds: int = DEFAULT_NOTICE_SECONDS):
        self.activate_technical_works(operation=operation, message=message)
        try:
            yield
        finally:
            self.deactivate_technical_works(notice_seconds=notice_seconds)


platform_status_service = PlatformStatusService()
