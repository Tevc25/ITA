import { Ban, CalendarClock, CarFront, LoaderCircle, RefreshCw, Search, UserRound, XCircle } from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { ApiClient, ApiError } from "@shared/api";
import type { ReservationsMfeProps } from "@shared/contracts";
import { formatDateTime, toIsoStringFromLocal, toLocalInputDateTime } from "@shared/date";
import type { ParkingLot, Reservation, ReservationScope } from "@shared/types";

import "../styles.css";

function getFriendlyMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Unexpected error. Please retry.";
}

function ReservationSkeleton() {
  return (
    <div className="reservation-skeleton-list" aria-hidden="true">
      {Array.from({ length: 3 }).map((_, index) => (
        <div className="reservation-skeleton-item" key={index}>
          <div className="skeleton-line skeleton-title" />
          <div className="skeleton-line" />
          <div className="skeleton-line" />
        </div>
      ))}
    </div>
  );
}

function isCancellable(status: string): boolean {
  const normalized = status.toLowerCase();
  return !(normalized.includes("cancel") || normalized.includes("past") || normalized.includes("done"));
}

export default function ReservationsApp({ apiBaseUrl, session, selectedLot }: ReservationsMfeProps) {
  const api = useMemo(() => new ApiClient(apiBaseUrl), [apiBaseUrl]);

  const [vehiclePlate, setVehiclePlate] = useState("LJ-TEST-123");
  const [parkingLotId, setParkingLotId] = useState("");
  const [startTime, setStartTime] = useState(() => toLocalInputDateTime(new Date().toISOString()));
  const [endTime, setEndTime] = useState(() => toLocalInputDateTime(new Date(Date.now() + 60 * 60 * 1000).toISOString()));
  const [parkingLots, setParkingLots] = useState<ParkingLot[]>([]);
  const [loadingLots, setLoadingLots] = useState(false);

  const [scope, setScope] = useState<ReservationScope>("active");
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  const [reservationIdInput, setReservationIdInput] = useState("");
  const [lookupResult, setLookupResult] = useState("Use this panel to test reservation API flows.");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const userId = session.user?.id || "";
  const selectedParkingLot = useMemo(
    () => parkingLots.find((lot) => lot.id === parkingLotId) || (selectedLot?.id === parkingLotId ? selectedLot : null),
    [parkingLotId, parkingLots, selectedLot],
  );

  useEffect(() => {
    if (selectedLot?.id) {
      setParkingLotId(selectedLot.id);
    }
  }, [selectedLot]);

  const loadParkingLots = useCallback(
    async (preferredLotId?: string) => {
      setLoadingLots(true);
      try {
        const result = await api.listParkingLots();
        setParkingLots(result);
        setParkingLotId((previous) => {
          if (preferredLotId && result.some((lot) => lot.id === preferredLotId)) {
            return preferredLotId;
          }
          if (previous && result.some((lot) => lot.id === previous)) {
            return previous;
          }
          return result[0]?.id || "";
        });
      } catch (requestError) {
        setError(getFriendlyMessage(requestError));
      } finally {
        setLoadingLots(false);
      }
    },
    [api],
  );

  const loadMyReservations = useCallback(async (targetScope: ReservationScope = scope) => {
    if (!userId) {
      setReservations([]);
      return;
    }

    setLoadingList(true);
    try {
      const result = await api.listUserReservations(userId, targetScope);
      setReservations(result);
      setError(null);
    } catch (requestError) {
      setError(getFriendlyMessage(requestError));
    } finally {
      setLoadingList(false);
    }
  }, [api, scope, userId]);

  useEffect(() => {
    void loadParkingLots();
  }, [loadParkingLots]);

  useEffect(() => {
    void loadMyReservations(scope);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, userId, loadMyReservations]);

  async function handleCreateReservation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError(null);
    setMessage(null);

    if (!userId) {
      setError("Login is required to create reservations.");
      return;
    }

    if (!parkingLotId.trim()) {
      setError("Choose parking lot before creating reservation.");
      return;
    }

    if (!vehiclePlate.trim()) {
      setError("Vehicle plate is required.");
      return;
    }

    let startIso: string;
    let endIso: string;
    try {
      startIso = toIsoStringFromLocal(startTime);
      endIso = toIsoStringFromLocal(endTime);
    } catch {
      setError("Start and end time are required.");
      return;
    }

    if (new Date(endIso).getTime() <= new Date(startIso).getTime()) {
      setError("End time must be after start time.");
      return;
    }

    try {
      setBusy(true);
      const created = await api.createReservation({
        user_id: userId,
        parking_lot_id: parkingLotId.trim(),
        vehicle_plate: vehiclePlate.trim(),
        start_time: startIso,
        end_time: endIso,
      });
      setMessage(`Reservation ${created.id} created.`);
      setLookupResult(JSON.stringify(created, null, 2));
      setReservationIdInput(created.id);
      await loadMyReservations(scope);
    } catch (requestError) {
      setError(getFriendlyMessage(requestError));
    } finally {
      setBusy(false);
    }
  }

  async function handleGetReservation(targetReservationId?: string) {
    const reservationId = (targetReservationId || reservationIdInput).trim();
    if (!reservationId) {
      setLookupResult("Enter reservation ID.");
      return;
    }

    setBusy(true);
    try {
      const result = await api.getReservation(reservationId);
      setReservationIdInput(reservationId);
      setLookupResult(JSON.stringify(result, null, 2));
      setError(null);
    } catch (requestError) {
      setError(getFriendlyMessage(requestError));
    } finally {
      setBusy(false);
    }
  }

  async function handleCancelReservation(id: string) {
    if (!userId) {
      setError("Login is required to cancel reservations.");
      return;
    }

    setBusy(true);
    try {
      const cancelled = await api.cancelReservation(id, userId);
      setMessage(`Reservation ${cancelled.id} cancelled.`);
      setLookupResult(JSON.stringify(cancelled, null, 2));
      await loadMyReservations(scope);
    } catch (requestError) {
      setError(getFriendlyMessage(requestError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="reservations-app">
      <section className="reservations-header">
        <div>
          <h2>
            <CalendarClock size={20} /> Reservations
          </h2>
          <p>Create reservations from selected parking lots, then manage active and past bookings.</p>
        </div>
        <button type="button" className="header-refresh-btn" onClick={() => void loadParkingLots(parkingLotId)} disabled={loadingLots}>
          {loadingLots ? <LoaderCircle size={15} className="spin" /> : <RefreshCw size={15} />}
          Refresh lots
        </button>
      </section>

      <section className="reservation-create-card">
        <div className="reservation-create-head">
          <h3>
            <CarFront size={16} /> Create Reservation
          </h3>
          <div className="reservation-user-chip">
            <UserRound size={14} />
            {session.user ? `${session.user.name} (${session.user.email})` : "Login required"}
          </div>
        </div>

        <form className="reservation-create-form" onSubmit={handleCreateReservation}>
          <label>
            Parking Lot
            <select
              value={parkingLotId}
              onChange={(event) => setParkingLotId(event.target.value)}
              disabled={loadingLots || parkingLots.length === 0}
              required
            >
              <option value="">
                {loadingLots
                  ? "Loading parking lots..."
                  : parkingLots.length === 0
                    ? "No parking lots available"
                    : "Select parking lot"}
              </option>
              {parkingLots.map((lot) => (
                <option key={lot.id} value={lot.id}>
                  {lot.name} | {lot.available_spots}/{lot.capacity} free
                </option>
              ))}
            </select>
          </label>

          <label>
            Vehicle Plate
            <input
              type="text"
              value={vehiclePlate}
              onChange={(event) => setVehiclePlate(event.target.value)}
              placeholder="LJ-AB-123"
              required
            />
          </label>

          <label>
            Start Time
            <input
              type="datetime-local"
              value={startTime}
              onChange={(event) => setStartTime(event.target.value)}
              required
            />
          </label>

          <label>
            End Time
            <input type="datetime-local" value={endTime} onChange={(event) => setEndTime(event.target.value)} required />
          </label>

          <button type="submit" disabled={busy || !session.user}>
            {busy ? <LoaderCircle size={16} className="spin" /> : null}
            Create reservation
          </button>
        </form>

        {selectedParkingLot ? (
          <div className="reservation-lot-preview">
            <strong>{selectedParkingLot.name}</strong>
            <span>{selectedParkingLot.location}</span>
            <span>
              Capacity {selectedParkingLot.capacity} | Free spots {selectedParkingLot.available_spots}
            </span>
          </div>
        ) : null}
      </section>

      {message ? <p className="reservation-message success">{message}</p> : null}
      {error ? <p className="reservation-message error">{error}</p> : null}

      <section className="reservation-tools-grid">
        <article className="reservation-list-card">
          <header>
            <h3>My Reservations</h3>
            <div className="scope-switcher">
              <button type="button" className={scope === "all" ? "active" : ""} onClick={() => setScope("all")}>
                All
              </button>
              <button
                type="button"
                className={scope === "active" ? "active" : ""}
                onClick={() => setScope("active")}
              >
                Active
              </button>
              <button type="button" className={scope === "past" ? "active" : ""} onClick={() => setScope("past")}>
                Past
              </button>
            </div>
          </header>

          {loadingList ? (
            <ReservationSkeleton />
          ) : reservations.length === 0 ? (
            <div className="reservation-empty">
              <p>No reservations found for scope: {scope}</p>
              <button type="button" onClick={() => loadMyReservations(scope)}>
                Retry
              </button>
            </div>
          ) : (
            <div className="reservation-list">
              {reservations.map((reservation) => (
                <article key={reservation.id} className="reservation-card">
                  <div className="reservation-card-head">
                    <strong>{reservation.id}</strong>
                    <span className="reservation-status">{reservation.status}</span>
                  </div>
                  <p>Lot: {reservation.parking_lot_id}</p>
                  <p>Plate: {reservation.vehicle_plate}</p>
                  <p>
                    {formatDateTime(reservation.start_time)} - {formatDateTime(reservation.end_time)}
                  </p>
                  <div className="reservation-card-actions">
                    <button
                      type="button"
                      onClick={async () => {
                        await handleGetReservation(reservation.id);
                      }}
                    >
                      <Search size={14} /> Details
                    </button>
                    {isCancellable(reservation.status) ? (
                      <button type="button" className="danger" onClick={() => handleCancelReservation(reservation.id)}>
                        <Ban size={14} /> Cancel
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </article>

        <article className="reservation-lookup-card">
          <h3>
            <Search size={16} /> Reservation Lookup
          </h3>

          <div className="lookup-inline">
            <input
              type="text"
              value={reservationIdInput}
              onChange={(event) => setReservationIdInput(event.target.value)}
              placeholder="Reservation ID"
            />
            <button type="button" onClick={() => void handleGetReservation()} disabled={busy}>
              Get Reservation
            </button>
          </div>

          <textarea className="lookup-result" value={lookupResult} readOnly />

          {!session.user ? (
            <p className="lookup-note">
              <XCircle size={14} /> Login first for create/cancel/list-my-reservations operations.
            </p>
          ) : null}
        </article>
      </section>
    </div>
  );
}
