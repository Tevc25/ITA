package main

import (
	"context"
	"fmt"
	"log/slog"
	"net"
	"os"
	"os/signal"
	"syscall"

	"google.golang.org/grpc"
	"google.golang.org/grpc/reflection"

	appservice "parkirisca/internal/application/service"
	"parkirisca/internal/infrastructure/config"
	"parkirisca/internal/infrastructure/database"
	infralogger "parkirisca/internal/infrastructure/logger"
	"parkirisca/internal/infrastructure/repository"
	grpciface "parkirisca/internal/interfaces/grpc"
	pb "parkirisca/proto/gen/parking"
)

func main() {
	cfg := config.Load()
	logger := infralogger.New(cfg.LogLevel)

	if err := run(cfg, logger); err != nil {
		logger.Error("server terminated with error", "error", err)
		os.Exit(1)
	}
}

func run(cfg config.Config, logger *slog.Logger) error {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	db, err := database.Open(cfg.DBDriver, cfg.DBPath)
	if err != nil {
		return fmt.Errorf("open database: %w", err)
	}
	defer db.Close()

	if err := database.Migrate(ctx, db); err != nil {
		return fmt.Errorf("run migrations: %w", err)
	}

	repo := repository.NewSQLiteRepository(db)
	service := appservice.NewParkingService(repo, logger)
	handler := grpciface.NewHandler(service)

	address := ":" + cfg.GRPCPort
	listener, err := net.Listen("tcp", address)
	if err != nil {
		return fmt.Errorf("listen on %s: %w", address, err)
	}
	defer listener.Close()

	grpcServer := grpc.NewServer()
	pb.RegisterParkingServiceServer(grpcServer, handler)
	reflection.Register(grpcServer)

	serverErr := make(chan error, 1)
	go func() {
		logger.Info("gRPC server listening", "port", cfg.GRPCPort, "app", cfg.AppName)
		serverErr <- grpcServer.Serve(listener)
	}()

	select {
	case <-ctx.Done():
		logger.Info("shutdown signal received")
		grpcServer.GracefulStop()
		return nil
	case err := <-serverErr:
		if err != nil {
			return fmt.Errorf("serve grpc: %w", err)
		}
		return nil
	}
}
