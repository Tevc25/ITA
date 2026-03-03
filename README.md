# Sistem za parkirišča

## Opis projekta
Sistem za parkirišča je mikrostoritvena aplikacija, ki omogoča pregled parkirišč, prikaz razpoložljivosti (prosta mesta) ter rezervacijo parkirnih mest preko spletnega uporabniškega vmesnika.

Sistem je zasnovan po načelih **Clean Architecture** (poslovna logika je neodvisna od infrastrukture) in **screaming architecture** (struktura repozitorija že iz imen map pokaže namen sistema – parkirišča, uporabniki, rezervacije).

---

## Arhitektura sistema (3 mikrostoritve + spletni UI)

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

---

## Komunikacija med komponentami
- Spletni vmesnik komunicira z mikrostoritvami preko **REST API (HTTP)**.
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
├── spletni-vmesnik/
│   ├── src/                    # UI logika in komponente
│   └── public/                 # statične datoteke
│
└── README.md
