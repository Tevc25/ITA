# gateway-web

API Gateway za spletni odjemalec (web) v Python/FastAPI.

## Zagon lokalno

```bash
cd gateway-web
python -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload --port 8090
```

Swagger: `http://localhost:8090/docs`

## Ključne poti

- `POST /api/web/auth/register`
- `POST /api/web/auth/login`
- `GET /api/web/me`
- `GET/POST/GET{id}/PATCH/DELETE /api/web/parking-lots...`
- `POST /api/web/reservations`
- `POST /api/web/reservations/{reservation_id}/cancel`
- `GET /api/web/reservations/{reservation_id}`
- `GET /api/web/users/{user_id}/reservations`
