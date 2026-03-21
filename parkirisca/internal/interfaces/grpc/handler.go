package grpc

import (
	"context"
	"errors"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"parkirisca/internal/application/dto"
	appservice "parkirisca/internal/application/service"
	"parkirisca/internal/domain"
	pb "parkirisca/proto/gen/parking"
)

type Handler struct {
	pb.UnimplementedParkingServiceServer
	service *appservice.ParkingService
}

func NewHandler(service *appservice.ParkingService) *Handler {
	return &Handler{service: service}
}

func (h *Handler) ListParkingLots(ctx context.Context, _ *pb.Empty) (*pb.ParkingLotListResponse, error) {
	lots, err := h.service.ListParkingLots(ctx)
	if err != nil {
		return nil, toGRPCError(err)
	}
	return toProtoParkingLotList(lots), nil
}

func (h *Handler) GetParkingLotById(ctx context.Context, req *pb.ParkingLotByIdRequest) (*pb.ParkingLotResponse, error) {
	lot, err := h.service.GetParkingLotByID(ctx, req.GetId())
	if err != nil {
		return nil, toGRPCError(err)
	}
	return &pb.ParkingLotResponse{ParkingLot: toProtoParkingLot(*lot)}, nil
}

func (h *Handler) CreateParkingLot(ctx context.Context, req *pb.CreateParkingLotRequest) (*pb.ParkingLotResponse, error) {
	lot, err := h.service.CreateParkingLot(ctx, dto.CreateParkingLotInput{
		Name:           req.GetName(),
		Location:       req.GetLocation(),
		Capacity:       req.GetCapacity(),
		AvailableSpots: req.GetAvailableSpots(),
	})
	if err != nil {
		return nil, toGRPCError(err)
	}

	return &pb.ParkingLotResponse{ParkingLot: toProtoParkingLot(*lot)}, nil
}

func (h *Handler) UpdateAvailability(ctx context.Context, req *pb.UpdateAvailabilityRequest) (*pb.ParkingLotResponse, error) {
	lot, err := h.service.UpdateAvailability(ctx, dto.UpdateAvailabilityInput{
		ID:             req.GetId(),
		AvailableSpots: req.GetAvailableSpots(),
	})
	if err != nil {
		return nil, toGRPCError(err)
	}
	return &pb.ParkingLotResponse{ParkingLot: toProtoParkingLot(*lot)}, nil
}

func (h *Handler) DeleteParkingLot(ctx context.Context, req *pb.ParkingLotByIdRequest) (*pb.DeleteResponse, error) {
	if err := h.service.DeleteParkingLot(ctx, req.GetId()); err != nil {
		return nil, toGRPCError(err)
	}
	return &pb.DeleteResponse{Success: true, Message: "parking lot deleted"}, nil
}

func toGRPCError(err error) error {
	switch {
	case errors.Is(err, domain.ErrParkingLotNotFound):
		return status.Error(codes.NotFound, err.Error())
	case errors.Is(err, domain.ErrInvalidID),
		errors.Is(err, domain.ErrInvalidName),
		errors.Is(err, domain.ErrInvalidLocation),
		errors.Is(err, domain.ErrInvalidCapacity),
		errors.Is(err, domain.ErrInvalidAvailability),
		errors.Is(err, domain.ErrAvailabilityExceedsCap):
		return status.Error(codes.InvalidArgument, err.Error())
	default:
		return status.Error(codes.Internal, "internal server error")
	}
}
