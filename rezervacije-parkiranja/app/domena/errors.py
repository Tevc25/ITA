class DomainError(Exception):
    """Base domain error."""


class ValidationError(DomainError):
    """Raised when reservation payload violates business rules."""


class ReservationAlreadyCancelledError(DomainError):
    """Raised when reservation is cancelled multiple times."""
