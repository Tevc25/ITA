package domain

import "strings"

type ParkingLot struct {
	ID             string
	Name           string
	Location       string
	Capacity       int32
	AvailableSpots int32
}

func NewParkingLot(id, name, location string, capacity, availableSpots int32) (ParkingLot, error) {
	lot := ParkingLot{
		ID:             strings.TrimSpace(id),
		Name:           strings.TrimSpace(name),
		Location:       strings.TrimSpace(location),
		Capacity:       capacity,
		AvailableSpots: availableSpots,
	}

	if err := lot.Validate(); err != nil {
		return ParkingLot{}, err
	}

	return lot, nil
}

func (p ParkingLot) Validate() error {
	if p.ID == "" {
		return ErrInvalidID
	}
	if p.Name == "" {
		return ErrInvalidName
	}
	if p.Location == "" {
		return ErrInvalidLocation
	}
	if p.Capacity < 0 {
		return ErrInvalidCapacity
	}
	if p.AvailableSpots < 0 {
		return ErrInvalidAvailability
	}
	if p.AvailableSpots > p.Capacity {
		return ErrAvailabilityExceedsCap
	}
	return nil
}

func (p *ParkingLot) UpdateAvailability(availableSpots int32) error {
	if availableSpots < 0 {
		return ErrInvalidAvailability
	}
	if availableSpots > p.Capacity {
		return ErrAvailabilityExceedsCap
	}
	p.AvailableSpots = availableSpots
	return nil
}
