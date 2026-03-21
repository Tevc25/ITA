package grpc

import (
	"parkirisca/internal/domain"
	pb "parkirisca/proto/gen/parking"
)

func toProtoParkingLot(lot domain.ParkingLot) *pb.ParkingLot {
	return &pb.ParkingLot{
		Id:             lot.ID,
		Name:           lot.Name,
		Location:       lot.Location,
		Capacity:       lot.Capacity,
		AvailableSpots: lot.AvailableSpots,
	}
}

func toProtoParkingLotList(lots []domain.ParkingLot) *pb.ParkingLotListResponse {
	items := make([]*pb.ParkingLot, 0, len(lots))
	for _, lot := range lots {
		items = append(items, toProtoParkingLot(lot))
	}
	return &pb.ParkingLotListResponse{ParkingLots: items}
}
