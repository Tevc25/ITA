# parkirisca

Go mikrostoritev za upravljanje parkirišč z gRPC API, HTTP API (Swagger/OpenAPI), SQLite podatkovno bazo in Clean Architecture strukturo.

## Funkcionalnosti

- `ListParkingLots`
- `GetParkingLotById`
- `CreateParkingLot`
- `UpdateAvailability`
- `DeleteParkingLot`

## Zagon lokalno

```bash
cp .env.example .env
make proto
make tidy
make run
```

Privzet gRPC port je `50051`.
Privzet HTTP port je `8080`.

Swagger UI: `http://localhost:8080/docs`  
OpenAPI JSON: `http://localhost:8080/openapi.json`

## Testi

```bash
make test
```

## Build Docker slike

```bash
docker build -t ita-parkirisca .
```
