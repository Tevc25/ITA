# parkirisca

Go mikrostoritev za upravljanje parkirišč z gRPC API, SQLite podatkovno bazo in Clean Architecture strukturo.

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

## Testi

```bash
make test
```

## Build Docker slike

```bash
docker build -t ita-parkirisca .
```
