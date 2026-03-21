package integration_test

import (
	"context"
	"io"
	"log/slog"
	"net"
	"path/filepath"
	"testing"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/status"
	"google.golang.org/grpc/test/bufconn"

	appservice "parkirisca/internal/application/service"
	"parkirisca/internal/infrastructure/database"
	"parkirisca/internal/infrastructure/repository"
	grpciface "parkirisca/internal/interfaces/grpc"
	pb "parkirisca/proto/gen/parking"
)

const bufSize = 1024 * 1024

func TestParkingServiceGRPCFlow(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), "integration.db")
	db, err := database.Open("sqlite", dbPath)
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	defer db.Close()

	if err := database.Migrate(context.Background(), db); err != nil {
		t.Fatalf("migrate: %v", err)
	}

	repo := repository.NewSQLiteRepository(db)
	logger := slog.New(slog.NewJSONHandler(io.Discard, nil))
	service := appservice.NewParkingServiceWithIDFactory(repo, logger, func() string { return "grpc-lot-1" })
	handler := grpciface.NewHandler(service)

	listener := bufconn.Listen(bufSize)
	server := grpc.NewServer()
	pb.RegisterParkingServiceServer(server, handler)
	go func() {
		_ = server.Serve(listener)
	}()
	defer server.Stop()

	dialer := func(ctx context.Context, _ string) (net.Conn, error) {
		return listener.Dial()
	}

	conn, err := grpc.NewClient("passthrough:///bufnet",
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithContextDialer(dialer),
	)
	if err != nil {
		t.Fatalf("dial bufconn: %v", err)
	}
	defer conn.Close()

	client := pb.NewParkingServiceClient(conn)

	createResp, err := client.CreateParkingLot(context.Background(), &pb.CreateParkingLotRequest{
		Name:           "Kongresni trg",
		Location:       "Ljubljana",
		Capacity:       50,
		AvailableSpots: 30,
	})
	if err != nil {
		t.Fatalf("create rpc: %v", err)
	}
	if createResp.GetParkingLot().GetId() != "grpc-lot-1" {
		t.Fatalf("expected id grpc-lot-1, got %s", createResp.GetParkingLot().GetId())
	}

	getResp, err := client.GetParkingLotById(context.Background(), &pb.ParkingLotByIdRequest{Id: "grpc-lot-1"})
	if err != nil {
		t.Fatalf("get rpc: %v", err)
	}
	if getResp.GetParkingLot().GetName() != "Kongresni trg" {
		t.Fatalf("expected name Kongresni trg, got %s", getResp.GetParkingLot().GetName())
	}

	listResp, err := client.ListParkingLots(context.Background(), &pb.Empty{})
	if err != nil {
		t.Fatalf("list rpc: %v", err)
	}
	if len(listResp.GetParkingLots()) != 1 {
		t.Fatalf("expected 1 lot, got %d", len(listResp.GetParkingLots()))
	}

	updateResp, err := client.UpdateAvailability(context.Background(), &pb.UpdateAvailabilityRequest{
		Id:             "grpc-lot-1",
		AvailableSpots: 20,
	})
	if err != nil {
		t.Fatalf("update rpc: %v", err)
	}
	if updateResp.GetParkingLot().GetAvailableSpots() != 20 {
		t.Fatalf("expected available spots 20, got %d", updateResp.GetParkingLot().GetAvailableSpots())
	}

	deleteResp, err := client.DeleteParkingLot(context.Background(), &pb.ParkingLotByIdRequest{Id: "grpc-lot-1"})
	if err != nil {
		t.Fatalf("delete rpc: %v", err)
	}
	if !deleteResp.GetSuccess() {
		t.Fatalf("expected success delete response")
	}

	_, err = client.GetParkingLotById(context.Background(), &pb.ParkingLotByIdRequest{Id: "grpc-lot-1"})
	if status.Code(err) != codes.NotFound {
		t.Fatalf("expected NotFound after delete, got %v (err=%v)", status.Code(err), err)
	}
}
