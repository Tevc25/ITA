package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/reflection"

	appservice "parkirisca/internal/application/service"
	"parkirisca/internal/infrastructure/config"
	"parkirisca/internal/infrastructure/database"
	infralogger "parkirisca/internal/infrastructure/logger"
	"parkirisca/internal/infrastructure/repository"
	grpciface "parkirisca/internal/interfaces/grpc"
	httpiface "parkirisca/internal/interfaces/http"
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

	grpcAddress := ":" + cfg.GRPCPort
	listener, err := net.Listen("tcp", grpcAddress)
	if err != nil {
		return fmt.Errorf("listen on %s: %w", grpcAddress, err)
	}
	defer listener.Close()

	grpcServer := grpc.NewServer()
	pb.RegisterParkingServiceServer(grpcServer, handler)
	reflection.Register(grpcServer)

	httpAdapter := httpiface.NewHandler(service)
	httpMux := http.NewServeMux()
	httpAdapter.RegisterRoutes(httpMux)
	httpServer := &http.Server{
		Addr:    ":" + cfg.HTTPPort,
		Handler: httpMux,
	}

	serverErr := make(chan error, 2)
	go func() {
		logger.Info("gRPC server listening", "port", cfg.GRPCPort, "app", cfg.AppName)
		if err := grpcServer.Serve(listener); err != nil {
			serverErr <- fmt.Errorf("serve grpc: %w", err)
		}
	}()

	go func() {
		logger.Info("HTTP server listening", "port", cfg.HTTPPort, "app", cfg.AppName)
		if err := httpServer.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			serverErr <- fmt.Errorf("serve http: %w", err)
		}
	}()

	select {
	case <-ctx.Done():
		logger.Info("shutdown signal received")
		grpcServer.GracefulStop()

		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := httpServer.Shutdown(shutdownCtx); err != nil {
			return fmt.Errorf("shutdown http server: %w", err)
		}
		return nil
	case err := <-serverErr:
		return err
	}
}
