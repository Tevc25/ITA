package unit_test

import (
	"errors"
	"testing"

	"parkirisca/internal/domain"
)

func TestNewParkingLotValidation(t *testing.T) {
	tests := []struct {
		name    string
		id      string
		lotName string
		loc     string
		cap     int32
		avail   int32
		wantErr error
	}{
		{name: "missing id", id: "", lotName: "A", loc: "B", cap: 10, avail: 5, wantErr: domain.ErrInvalidID},
		{name: "missing name", id: "1", lotName: "", loc: "B", cap: 10, avail: 5, wantErr: domain.ErrInvalidName},
		{name: "negative capacity", id: "1", lotName: "A", loc: "B", cap: -1, avail: 0, wantErr: domain.ErrInvalidCapacity},
		{name: "availability exceeds capacity", id: "1", lotName: "A", loc: "B", cap: 1, avail: 2, wantErr: domain.ErrAvailabilityExceedsCap},
		{name: "valid", id: "1", lotName: "A", loc: "B", cap: 10, avail: 5, wantErr: nil},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			_, err := domain.NewParkingLot(tc.id, tc.lotName, tc.loc, tc.cap, tc.avail)
			if tc.wantErr == nil && err != nil {
				t.Fatalf("expected no error, got %v", err)
			}
			if tc.wantErr != nil && !errors.Is(err, tc.wantErr) {
				t.Fatalf("expected error %v, got %v", tc.wantErr, err)
			}
		})
	}
}
