from app.circuit_breaker import CircuitBreaker


def test_circuit_breaker_opens_after_threshold() -> None:
    breaker = CircuitBreaker(failure_threshold=2, recovery_timeout_seconds=5)

    assert breaker.allow_request() is True
    breaker.record_failure()
    assert breaker.allow_request() is True

    breaker.record_failure()
    assert breaker.allow_request() is False

    snapshot = breaker.snapshot()
    assert snapshot["state"] == "open"
    assert snapshot["retry_after_seconds"] is not None


def test_circuit_breaker_recovers_on_success() -> None:
    breaker = CircuitBreaker(failure_threshold=1, recovery_timeout_seconds=0.01)
    breaker.record_failure()
    assert breaker.snapshot()["state"] == "open"

    # Wait long enough so allow_request transitions to half-open.
    import time

    time.sleep(0.02)
    assert breaker.allow_request() is True

    breaker.record_success()
    snapshot = breaker.snapshot()
    assert snapshot["state"] == "closed"
    assert snapshot["failure_count"] == 0
