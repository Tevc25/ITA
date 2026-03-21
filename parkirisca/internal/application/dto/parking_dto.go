package dto

type CreateParkingLotInput struct {
	Name           string
	Location       string
	Capacity       int32
	AvailableSpots int32
}

type UpdateAvailabilityInput struct {
	ID             string
	AvailableSpots int32
}
