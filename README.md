# Sistem za parkirišča

## Opis projekta
Sistem za parkirišča je mikrostoritvena aplikacija, ki omogoča pregled parkirišč, prikaz razpoložljivosti (prosta mesta) ter rezervacijo parkirnih mest preko spletnega uporabniškega vmesnika.

Sistem je zasnovan po načelih **Clean Architecture** (poslovna logika je neodvisna od infrastrukture) in **screaming architecture** (struktura repozitorija že iz imen map pokaže namen sistema – parkirišča, uporabniki, rezervacije).

---

## Arhitektura sistema (3 mikrostoritve + 2 API prehoda + spletni UI)

### Mikrostoritve
1. **Storitev uporabniki**
   - registracija in prijava uporabnika
   - uporabniški profil
   - upravljanje osnovnih podatkov uporabnika

2. **Storitev parkirišča**
   - seznam parkirišč (ime, lokacija)
   - kapaciteta parkirišča
   - trenutno število prostih mest

3. **Storitev rezervacije parkiranja**
   - ustvarjanje rezervacije
   - preklic rezervacije
   - pregled aktivnih/preteklih rezervacij uporabnika
   - povezava: uporabnik ↔ parkirišče ↔ časovni interval

### Spletni uporabniški vmesnik
- prijava/registracija
- pregled parkirišč in razpoložljivosti
- rezervacija parkirnega mesta
- moje rezervacije

### API prehoda (API Gateway)
1. **gateway-web** (Python/FastAPI)
   - enotna vstopna točka za spletni odjemalec
   - endpointi pod `/api/web/...`
   - OpenAPI/Swagger na `/docs`

2. **gateway-mobile** (Go)
   - enotna vstopna točka za mobilni odjemalec
   - endpointi pod `/api/mobile/...`
   - vključuje agregiran endpoint `/api/mobile/dashboard/{userId}`

---

## Naloga 9: Brezstrežniški zaledni sistem (FaaS)

Za nalogo 9 je dodan ločen serverless projekt v mapi `faas-events/`.

- tehnologija: **Serverless Framework (AWS Lambda)**
- varnost: **JWT + Lambda authorizer**
- event tipi: **DynamoDB Stream**, **S3 ObjectCreated**, **SQS**, **schedule/cron**, **HTTP eventi**
- pokrite funkcionalnosti: auth, parkirišča, rezervacije, datoteke, obveščanje/avtomatizacija

Podrobnosti:

- dokumentacija: `faas-events/README.md`
- konfiguracija: `faas-events/serverless.yml`
- Postman kolekcija: `faas-events/postman/FaaS-Events.postman_collection.json`

---

## Komunikacija med komponentami
- Odjemalci komunicirajo preko **API prehodov (REST/HTTP)**.
- `gateway-web` in `gateway-mobile` posredujeta zahtevke do mikrostoritev (`uporabniki`, `parkirisca`, `rezervacije-parkiranja`).
- Storitev rezervacij lahko po potrebi preveri stanje parkirišča pri storitvi parkirišč (npr. pri ustvarjanju rezervacije).

Primer poteka:
1. Uporabnik se prijavi.
2. UI pridobi seznam parkirišč in prosta mesta.
3. Uporabnik izbere parkirišče in ustvari rezervacijo.
4. Rezervacije se shranijo in so vidne v “Moje rezervacije”.

---

## Načela (Clean Architecture)
- **Domena (business rules)** ne pozna baze, frameworkov ali zunanjih API-jev.
- Odvisnosti tečejo **od zunanjosti proti notranjosti**:
  - API/infrastruktura → aplikacijska logika → domena
- Mikrostoritve so **ohlapno sklopljene** in samostojne.

---

## Struktura repozitorija (screaming architecture)

```text
sistem-za-parkirisca/
│
├── uporabniki/
│   ├── domena/                 # poslovni koncepti: User, pravila registracije, validacije ...
│   ├── aplikacija/             # use-casei: register, login, profile ...
│   ├── infrastruktura/         # baza, repo implementacije, zunanji adapterji ...
│   └── api/                    # REST controllerji, request/response DTO-ji ...
│
├── parkirisca/
│   ├── domena/                 # ParkingLot, Capacity, Availability ...
│   ├── aplikacija/             # use-casei: list parking lots, update availability ...
│   ├── infrastruktura/         # baza, repo implementacije ...
│   └── api/                    # REST endpointi ...
│
├── rezervacije-parkiranja/
│   ├── domena/                 # Reservation, statusi, pravila rezerviranja ...
│   ├── aplikacija/             # use-casei: create/cancel reservation, list reservations ...
│   ├── infrastruktura/         # baza, repo, integracije do drugih storitev ...
│   └── api/                    # REST endpointi ...
│
├── gateway-web/                # API Gateway za web odjemalec (Python/FastAPI)
├── gateway-mobile/             # API Gateway za mobile odjemalec (Go)
├── faas-events/                # Serverless FaaS backend (Naloga 9)
│
├── spletni-vmesnik/
│   ├── shell/                  # host app (React + TS, Module Federation)
│   ├── mfe-auth/               # auth/users micro frontend
│   ├── mfe-parking/            # parking + map + parking admin tools MFE
│   ├── mfe-reservations/       # reservations MFE
│   ├── shared/                 # shared typed API + utility layer
│   └── nginx.conf              # reverse proxy do gateway-web
│
└── README.md
```

---

## Frontend (Micro Frontends)

Spletni odjemalec je implementiran v **React + TypeScript** in razdeljen v več MFE aplikacij:

- `shell` (container/host): sestavljanje remote modulov, navigacija, session state
- `mfe-auth`: registracija + prijava
- `mfe-parking`: seznam/filtri/sort, mapa (OpenStreetMap + Leaflet), detajli + ločen create-parking view z map pickerjem + update availability/delete za izbran lot
- `mfe-reservations`: create/get/list/cancel rezervacij brez ročnega vnosa user ID (uporabi prijavljenega uporabnika) in z izbiro parkirišča iz seznama
- `shared`: enoten tipiziran API klient in skupni tipi/utili

Uporabljen je pristop **Module Federation** z jasno ločenimi app mapami.

### Dodatno uvedena vzorca mikroservisne arhitekture

- **Odklopnik (Circuit Breaker)** v `gateway-web`: pri ponavljajočih napakah posamezne storitve gateway začasno prekine klice in vrača `503`, nato po timeoutu preide v half-open režim.
- **Vmesnik za preverjanje stanja (Health Check API + UI)**: `gateway-web` izpostavi agregiran endpoint `/api/web/system/status`, shell `API Lab` pa prikaže health/circuit stanje vseh ključnih storitev.

---

## Zagon celotnega sistema lokalno

```bash
docker compose up --build
```

Po zagonu:

- spletni vmesnik (Micro Frontends shell): `http://localhost:8088`
- gateway-web (Swagger): `http://localhost:8090/docs`
- gateway-mobile: `http://localhost:8091`
- uporabniki: `http://localhost:3000`
- parkirisca: `http://localhost:8080`
- rezervacije-parkiranja: `http://localhost:8000`

---

## OpenShift deployment (potrjeno)

Sistem je bil uspešno nameščen na OpenShift projektu `tevec-dev` in preverjen 24. 3. 2026.

### Stanje komponent

Na clusterju tečejo vse ključne komponente:

- `uporabniki`
- `parkirisca`
- `rezervacije-parkiranja`
- `gateway-web`
- `gateway-mobile`
- `spletni-vmesnik`
- `activemq`

Preverba:

```bash
oc get pods
oc get route
```

### Dostopni URL-ji (OpenShift)

- Frontend: `https://spletni-vmesnik-tevec-dev.apps.rm1.0a51.p1.openshiftapps.com`
- Gateway Web: `https://gateway-web-tevec-dev.apps.rm1.0a51.p1.openshiftapps.com`

Hitri smoke test:

```bash
curl -k https://gateway-web-tevec-dev.apps.rm1.0a51.p1.openshiftapps.com/health
curl -k https://spletni-vmesnik-tevec-dev.apps.rm1.0a51.p1.openshiftapps.com/health
curl -k https://spletni-vmesnik-tevec-dev.apps.rm1.0a51.p1.openshiftapps.com/api/web/system/status
```

Pri uspešnem stanju `/api/web/system/status` vrne `status: "ok"` in vse storitve označi kot `up: true`.

### Opomba za broker (ActiveMQ)

Za strogi način (rezervacije se ne zaženejo brez brokerja) mora biti nastavljen:

- `BROKER_ENABLED=true`
- `BROKER_REQUIRED=true`
- `ACTIVEMQ_HOST=activemq`
- `ACTIVEMQ_PORT=61613`

V logu storitve `rezervacije-parkiranja` mora biti viden zapis `Connected to ActiveMQ`.

### Opomba za UI prijavo

Če UI kaže `Gateway unreachable` ali `401` po spremembah deploymenta, počisti lokalni session v browserju:

```js
localStorage.removeItem("ita.smartparking.session");
location.reload();
```

---

## Frontend lokalni razvoj (brez Docker)

```bash
cd spletni-vmesnik
npm run install:all
npm run dev
```

Privzeti porti:

- shell: `http://localhost:5173`
- mfe-auth: `http://localhost:5174`
- mfe-parking: `http://localhost:5175`
- mfe-reservations: `http://localhost:5176`

---

## API in map predpostavke

- Frontend kliče backend prek `gateway-web` (`/api/web/...`), brez hardcodanih skrivnosti.
- Za prikaz markerjev na mapi frontend podpira:
  - eksplicitne `latitude/longitude` (če jih backend vrne),
  - geocoding naslova preko OpenStreetMap Nominatim (če `lat/lng` ni podan),
  - ali `lat,lng` zapis v polju `location`,
  - sicer determinističen fallback iz `location` besedila (za stabilen prikaz markerjev).

---

## GitHub Actions: gradnja in objava Docker slik

Dodana je pipeline datoteka:

- `.github/workflows/docker-images.yml`
- `.github/workflows/spletni-vmesnik-ci.yml`

Pipeline:

- ob `pull_request`: naredi validacijski build slik za vse komponente
- ob `push` na `main` ali `master`: zgradi in objavi slike na DockerHub

Pokrite komponente:

- `parkirisca`
- `rezervacije-parkiranja`
- `uporabniki`
- `gateway-web`
- `gateway-mobile`
- `spletni-vmesnik`

Potrebne GitHub Secrets:

- `DOCKERHUB_USERNAME`
- `DOCKERHUB_TOKEN`

Tagi slik na DockerHub:

- `DOCKERHUB_USERNAME/ita-<komponenta>:latest`
- `DOCKERHUB_USERNAME/ita-<komponenta>:<git-sha>`
