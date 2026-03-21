#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

export PATH="$(go env GOPATH)/bin:$PATH"

protoc \
  --go_out=. \
  --go_opt=module=parkirisca \
  --go-grpc_out=. \
  --go-grpc_opt=module=parkirisca \
  proto/parking.proto
