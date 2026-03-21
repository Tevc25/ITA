package domain

import "errors"

var (
	ErrParkingLotNotFound     = errors.New("parking lot not found")
	ErrInvalidID              = errors.New("id is required")
	ErrInvalidName            = errors.New("name is required")
	ErrInvalidLocation        = errors.New("location is required")
	ErrInvalidCapacity        = errors.New("capacity must be greater than or equal to 0")
	ErrInvalidAvailability    = errors.New("available spots must be greater than or equal to 0")
	ErrAvailabilityExceedsCap = errors.New("available spots cannot exceed capacity")
)
