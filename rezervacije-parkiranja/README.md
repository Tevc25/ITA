# rezervacije-parkiranja

Python mikrostoritev za rezervacije parkirnih mest.

## Tehnologije

- FastAPI (REST + OpenAPI)
- SQLAlchemy Async + SQLite
- ActiveMQ (STOMP) za asinhrono objavo dogodkov
- pytest za unit teste

## Funkcionalnosti

- Ustvarjanje rezervacije
- Preklic rezervacije
- Pregled rezervacije po ID
- Pregled rezervacij uporabnika (`all`, `active`, `past`)

## Reaktiven slog

Storitev uporablja asinhroni (`async/await`) pristop in reaktiven tok dogodkov z `asyncio.Queue`:

1. Use-case objavi domeni dogodek (`reservation.created`, `reservation.cancelled`)
2. Dogodek se doda v asinhrono vrsto
3. Background worker dogodek pošlje v ActiveMQ

## Zagon lokalno

```bash
cd rezervacije-parkiranja
cp .env.example .env
python -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload
```

API: `http://localhost:8000`
Swagger/OpenAPI: `http://localhost:8000/docs`

## Testi

```bash
cd rezervacije-parkiranja
pytest -q
```

## Docker build

```bash
docker build -t ita-rezervacije-parkiranja .
```
