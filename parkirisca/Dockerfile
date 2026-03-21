FROM golang:1.25 AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /app/parkirisca ./cmd/server

FROM gcr.io/distroless/base-debian12

WORKDIR /app
COPY --from=builder /app/parkirisca /app/parkirisca

EXPOSE 50051

CMD ["/app/parkirisca"]
