# FaaS Events (Naloga 9)

Brezstrežniški zaledni sistem za domeno pametnega parkiranja, implementiran s **Serverless Framework (AWS)**.

## Uporabljena arhitektura

- **FaaS**: AWS Lambda funkcije
- **BAAS**: DynamoDB (`users`, `parking-lots`, `reservations`)
- **Storage**: S3 (`evidence` datoteke)
- **Messaging**: SQS (`notifications` queue)
- **Security**: JWT + Lambda authorizer

## 5 glavnih funkcionalnosti (z več funkcijami)

1. **Avtentikacija in zaščita API-ja**
- `authRegister`
- `authLogin`
- `authorizer`
- `me`

2. **Upravljanje parkirišč**
- `createParkingLot`
- `listParkingLots`
- `updateParkingAvailability`

3. **Upravljanje rezervacij**
- `createReservation`
- `cancelReservation`
- `listUserReservations`

4. **Delo z datotekami (dokazila rezervacije)**
- `requestEvidenceUploadUrl`
- `onEvidenceUploaded`

5. **Obveščanje in avtomatizacija**
- `onReservationDbChange`
- `processNotificationQueue`
- `expireReservations`
- `generateDailyReport`

## Uporabljeni tipi dogodkov (>= 4)

1. **Podatkovne spremembe**: DynamoDB Stream (`onReservationDbChange`)
2. **Shramba in datoteke**: S3 `ObjectCreated` (`onEvidenceUploaded`)
3. **Sporočila in obveščanje**: SQS consumer (`processNotificationQueue`)
4. **Časovni dogodki**: `rate` + `cron` (`expireReservations`, `generateDailyReport`)
5. **Uporabniški dogodki / HTTP**: REST klici (`auth`, `parking`, `reservations`)

## Varnost

- Javna endpointa: `POST /auth/register`, `POST /auth/login`
- Vsi ostali HTTP endpointi so zaščiteni z Lambda authorizerjem (`Bearer JWT`)

## Lokalni zagon

```bash
cd faas-events
make install
export JWT_SECRET="change-me"
export NOTIFICATION_QUEUE_URL="local-notifications-queue"
make offline STAGE=local
```

Offline HTTP API: `http://localhost:3010`

## Uvedba (deploy)

```bash
cd faas-events
export AWS_REGION=eu-central-1
export AWS_ACCESS_KEY_ID=...
export AWS_SECRET_ACCESS_KEY=...
export JWT_SECRET="change-me-prod"
make deploy STAGE=dev
```

## Testiranje (Postman)

Pripravljena kolekcija: `postman/FaaS-Events.postman_collection.json`

Priporočen vrstni red testov:

1. `Auth - Register`
2. `Auth - Login` (shrani `token`)
3. `Parking - Create`
4. `Parking - List`
5. `Reservation - Create` (shrani `reservationId`)
6. `Reservation - My List`
7. `Storage - Get Upload URL`
8. `Reservation - Cancel`

## Opombe za dogodke

- `serverless offline` je primeren predvsem za HTTP funkcije.
- Za realen test S3/DynamoDB Stream/SQS/schedule dogodkov uporabi `STAGE=dev` po deployu.
- Cron funkcije lahko ročno preveriš tudi z:

```bash
npx serverless invoke -f expireReservations --stage dev
npx serverless invoke -f generateDailyReport --stage dev
```