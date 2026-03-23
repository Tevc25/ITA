# gateway-mobile

API Gateway za mobilni odjemalec (mobile) v Go.

## Zagon lokalno

```bash
cd gateway-mobile
go run ./cmd/server
```

## Ključne poti

- `POST /api/mobile/session/register`
- `POST /api/mobile/session/login`
- `GET /api/mobile/profile`
- `GET /api/mobile/parking`
- `POST /api/mobile/booking`
- `POST /api/mobile/booking/{reservationId}/cancel`
- `GET /api/mobile/booking/{reservationId}`
- `GET /api/mobile/dashboard/{userId}`
