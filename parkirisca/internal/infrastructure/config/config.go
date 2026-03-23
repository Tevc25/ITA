package config

import (
	"os"
)

type Config struct {
	AppName  string
	GRPCPort string
	HTTPPort string
	DBDriver string
	DBPath   string
	LogLevel string
}

func Load() Config {
	return Config{
		AppName:  getEnv("APP_NAME", "parkirisca"),
		GRPCPort: getEnv("GRPC_PORT", "50051"),
		HTTPPort: getEnv("HTTP_PORT", "8080"),
		DBDriver: getEnv("DB_DRIVER", "sqlite"),
		DBPath:   getEnv("DB_PATH", "./data/parkirisca.db"),
		LogLevel: getEnv("LOG_LEVEL", "info"),
	}
}

func getEnv(key, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	return value
}
