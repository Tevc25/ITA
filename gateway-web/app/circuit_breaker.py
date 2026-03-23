from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from threading import Lock
from typing import Any

import time


class CircuitState(str, Enum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


class CircuitBreaker:
    def __init__(self, failure_threshold: int = 3, recovery_timeout_seconds: float = 15.0) -> None:
        self.failure_threshold = max(1, failure_threshold)
        self.recovery_timeout_seconds = max(0.01, recovery_timeout_seconds)

        self._state = CircuitState.CLOSED
        self._failure_count = 0
        self._opened_at_monotonic: float | None = None
        self._opened_at_utc: str | None = None
        self._lock = Lock()

    def _open(self) -> None:
        self._state = CircuitState.OPEN
        self._opened_at_monotonic = time.monotonic()
        self._opened_at_utc = datetime.now(tz=timezone.utc).isoformat()

    def allow_request(self) -> bool:
        with self._lock:
            if self._state == CircuitState.CLOSED:
                return True

            if self._state == CircuitState.HALF_OPEN:
                return True

            if self._opened_at_monotonic is None:
                self._open()
                return False

            elapsed = time.monotonic() - self._opened_at_monotonic
            if elapsed >= self.recovery_timeout_seconds:
                self._state = CircuitState.HALF_OPEN
                return True
            return False

    def record_success(self) -> None:
        with self._lock:
            self._state = CircuitState.CLOSED
            self._failure_count = 0
            self._opened_at_monotonic = None
            self._opened_at_utc = None

    def record_failure(self) -> None:
        with self._lock:
            if self._state == CircuitState.HALF_OPEN:
                self._failure_count = self.failure_threshold
                self._open()
                return

            self._failure_count += 1
            if self._failure_count >= self.failure_threshold:
                self._open()

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            retry_after_seconds: float | None = None
            if self._state == CircuitState.OPEN and self._opened_at_monotonic is not None:
                remaining = self.recovery_timeout_seconds - (time.monotonic() - self._opened_at_monotonic)
                retry_after_seconds = max(0.0, round(remaining, 2))

            return {
                "state": self._state.value,
                "failure_count": self._failure_count,
                "failure_threshold": self.failure_threshold,
                "recovery_timeout_seconds": self.recovery_timeout_seconds,
                "opened_at": self._opened_at_utc,
                "retry_after_seconds": retry_after_seconds,
            }
