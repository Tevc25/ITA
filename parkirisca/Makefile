APP_NAME ?= parkirisca
BIN_DIR ?= bin
BINARY ?= $(BIN_DIR)/$(APP_NAME)

.PHONY: run build test proto tidy clean

run:
	go run ./cmd/server

build:
	mkdir -p $(BIN_DIR)
	go build -o $(BINARY) ./cmd/server

test:
	go test ./... -v

proto:
	./scripts/gen_proto.sh

tidy:
	go mod tidy

clean:
	rm -rf $(BIN_DIR)
