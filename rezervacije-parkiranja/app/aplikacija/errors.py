class ApplicationError(Exception):
    """Base application-layer error."""


class NotFoundError(ApplicationError):
    """Raised when entity does not exist."""


class ConflictError(ApplicationError):
    """Raised when requested operation conflicts with existing state."""


class BadRequestError(ApplicationError):
    """Raised when request is invalid."""


class ForbiddenError(ApplicationError):
    """Raised when user is not allowed to perform operation."""
