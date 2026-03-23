# spletni-vmesnik

Modern React + TypeScript web client for the parking platform, implemented with **Micro Frontends**.

## Micro Frontends structure

- `shell/` - host/container app, navigation, session state, MFE composition
- `mfe-auth/` - login + registration module
- `mfe-parking/` - parking list, filters, map, details + dedicated create-parking mode
- `mfe-reservations/` - create/list/get/cancel reservations with user-ready create flow
- `shared/` - shared types, API client, date/session/map/availability utilities

Architecture approach:

- Vite + Module Federation (`@originjs/vite-plugin-federation`)
- Shell dynamically loads remote modules:
  - `mfe_auth/App`
  - `mfe_parking/App`
  - `mfe_reservations/App`

## Backend integration

Frontend uses the existing `gateway-web` REST surface:

- Auth/users: `/api/web/auth/*`, `/api/web/me`
- Parking: `/api/web/parking-lots*`
- Reservations: `/api/web/reservations*`, `/api/web/users/{userId}/reservations`

All requests are centralized in `shared/src/api.ts`.

## Map integration

- OpenStreetMap via Leaflet (`react-leaflet`)
- Parking lots are rendered as map markers with popups and reserve action.
- Separate "Create Parking" view lets users click on map to pick coordinates and auto-fill location text.
- If backend does not provide `latitude/longitude`, frontend first tries real geocoding through OpenStreetMap Nominatim.
- Geocoding results are cached in browser local storage to avoid repeated lookups.
- If geocoding fails, frontend falls back to deterministic coordinates derived from location text.

## User-ready flows

- No manual user ID entry for reservations; logged-in user is used automatically.
- Reservation create form uses selectable parking lots (name + availability), with prefill from selected dashboard lot.
- Parking module includes management actions for selected lot: refresh details, update availability, and delete.
- Shell navigation includes dedicated views:
  - `Dashboard` (browse + map + reserve CTA)
  - `Create Parking` (separate page with map picker)
  - `My Reservations`
  - `API Lab` (advanced testing)

## Local development

Install dependencies per app:

```bash
cd spletni-vmesnik
npm run install:all
```

Run all MFE apps (shell + remotes):

```bash
npm run dev
```

Typical local ports:

- shell: `http://localhost:5173`
- auth remote: `http://localhost:5174`
- parking remote: `http://localhost:5175`
- reservations remote: `http://localhost:5176`

Build all:

```bash
npm run build
```

## Docker

Frontend image is built from `spletni-vmesnik/Dockerfile` and serves:

- shell bundle at `/`
- auth remote at `/mfe-auth/`
- parking remote at `/mfe-parking/`
- reservations remote at `/mfe-reservations/`

Nginx proxies `/api/web/*` and `/health` to `gateway-web`.

## Environment variables

See `.env.example`.

Main variables:

- `VITE_API_BASE_URL` (default `/api/web`)
- `VITE_HEALTH_PATH` (default `/health`)
- `VITE_GEOCODE_ENABLED` (default `true`)
- `VITE_GEOCODE_ENDPOINT` (default `https://nominatim.openstreetmap.org/search`)
- `VITE_GEOCODE_COUNTRY_CODES` (example `si` for Slovenia-focused matching)
- `VITE_MFE_AUTH_REMOTE` (dev example: `http://localhost:5174/assets/remoteEntry.js`)
- `VITE_MFE_PARKING_REMOTE` (dev example: `http://localhost:5175/assets/remoteEntry.js`)
- `VITE_MFE_RESERVATIONS_REMOTE` (dev example: `http://localhost:5176/assets/remoteEntry.js`)

Production defaults (no env override needed in Docker):

- `/mfe-auth/assets/remoteEntry.js`
- `/mfe-parking/assets/remoteEntry.js`
- `/mfe-reservations/assets/remoteEntry.js`
