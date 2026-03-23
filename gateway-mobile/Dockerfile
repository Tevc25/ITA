FROM golang:1.25 AS builder

WORKDIR /app

COPY go.mod ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /app/gateway-mobile ./cmd/server

FROM gcr.io/distroless/base-debian12

WORKDIR /app
COPY --from=builder /app/gateway-mobile /app/gateway-mobile

EXPOSE 8091

CMD ["/app/gateway-mobile"]
