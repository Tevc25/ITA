import {
  Filter,
  LoaderCircle,
  LocateFixed,
  MapPinned,
  Navigation,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Trash2,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";

import { getAvailabilityColor, getAvailabilityLabel, getAvailabilityLevel } from "@shared/availability";
import { ApiClient, ApiError } from "@shared/api";
import type { ParkingMfeProps } from "@shared/contracts";
import {
  geocodeLotLocation,
  getLotCoordinates,
  getMapCenterFromCoordinates,
  getStaticLotCoordinates,
  reverseGeocodeCoordinates,
} from "@shared/map";
import type { ParkingLot } from "@shared/types";

import "leaflet/dist/leaflet.css";
import "../styles.css";

type Coordinates = [number, number];
type AvailabilityFilter = "all" | "high" | "medium" | "low";
type SortMode = "name" | "free-desc" | "free-asc" | "capacity-desc";

function getFriendlyMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Unexpected error. Please retry.";
}

function MapFlyToSelection({ coordinates }: { coordinates: Coordinates | null }) {
  const map = useMap();

  useEffect(() => {
    if (!coordinates) {
      return;
    }

    map.flyTo(coordinates, 15, { duration: 0.8 });
  }, [coordinates, map]);

  return null;
}

function MapClickPicker({
  selectedCoordinates,
  onPick,
}: {
  selectedCoordinates: Coordinates | null;
  onPick: (coordinates: Coordinates) => void;
}) {
  useMapEvents({
    click(event) {
      onPick([event.latlng.lat, event.latlng.lng]);
    },
  });

  if (!selectedCoordinates) {
    return null;
  }

  return (
    <CircleMarker
      center={selectedCoordinates}
      radius={10}
      pathOptions={{
        color: "#005fcc",
        fillColor: "#1f8dff",
        fillOpacity: 0.85,
        weight: 3,
      }}
    >
      <Popup>
        <strong>Selected location</strong>
        <br />
        {selectedCoordinates[0].toFixed(6)}, {selectedCoordinates[1].toFixed(6)}
      </Popup>
    </CircleMarker>
  );
}

function LotSkeleton() {
  return (
    <div className="parking-skeleton-list" aria-hidden="true">
      {Array.from({ length: 3 }).map((_, index) => (
        <div className="parking-skeleton-item" key={index}>
          <div className="skeleton-line skeleton-title" />
          <div className="skeleton-line" />
          <div className="skeleton-line" />
        </div>
      ))}
    </div>
  );
}

function lotMatchesFilter(lot: ParkingLot, filter: AvailabilityFilter): boolean {
  if (filter === "all") {
    return true;
  }

  return getAvailabilityLevel(lot) === filter;
}

function sortLots(lots: ParkingLot[], sort: SortMode): ParkingLot[] {
  const sorted = [...lots];

  if (sort === "name") {
    sorted.sort((left, right) => left.name.localeCompare(right.name));
  } else if (sort === "free-desc") {
    sorted.sort((left, right) => right.available_spots - left.available_spots);
  } else if (sort === "free-asc") {
    sorted.sort((left, right) => left.available_spots - right.available_spots);
  } else if (sort === "capacity-desc") {
    sorted.sort((left, right) => right.capacity - left.capacity);
  }

  return sorted;
}

export default function ParkingApp({ apiBaseUrl, session, onReserveLot, mode = "browse" }: ParkingMfeProps) {
  const api = useMemo(() => new ApiClient(apiBaseUrl), [apiBaseUrl]);

  const geocodeEnabled = (import.meta.env.VITE_GEOCODE_ENABLED ?? "true").toLowerCase() !== "false";
  const geocodeEndpoint = import.meta.env.VITE_GEOCODE_ENDPOINT || "https://nominatim.openstreetmap.org/search";
  const geocodeCountryCodes = import.meta.env.VITE_GEOCODE_COUNTRY_CODES || "";
  const reverseGeocodeEndpoint =
    import.meta.env.VITE_REVERSE_GEOCODE_ENDPOINT || "https://nominatim.openstreetmap.org/reverse";

  const [lots, setLots] = useState<ParkingLot[]>([]);
  const [selectedLot, setSelectedLot] = useState<ParkingLot | null>(null);

  const [coordinatesByLotId, setCoordinatesByLotId] = useState<Record<string, Coordinates>>({});
  const coordinatesRef = useRef<Record<string, Coordinates>>({});
  const [geocodeStatus, setGeocodeStatus] = useState<"idle" | "resolving" | "ready">("idle");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [availabilityFilter, setAvailabilityFilter] = useState<AvailabilityFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("name");

  const [createName, setCreateName] = useState("");
  const [createCapacity, setCreateCapacity] = useState(120);
  const [createAvailable, setCreateAvailable] = useState(60);
  const [createLocation, setCreateLocation] = useState("");
  const [createCoordinates, setCreateCoordinates] = useState<Coordinates | null>(null);
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createMessage, setCreateMessage] = useState<string | null>(null);
  const [reverseLookupBusy, setReverseLookupBusy] = useState(false);
  const reverseLookupRequestRef = useRef(0);

  const [manageAvailableSpots, setManageAvailableSpots] = useState(0);
  const [manageBusy, setManageBusy] = useState(false);
  const [manageMessage, setManageMessage] = useState<string | null>(null);
  const [manageError, setManageError] = useState<string | null>(null);

  function getResolvedCoordinates(lot: ParkingLot): Coordinates {
    return coordinatesByLotId[lot.id] ?? getLotCoordinates(lot);
  }

  async function loadLots({ background = false }: { background?: boolean } = {}) {
    if (background) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const result = await api.listParkingLots();
      setLots(result);
      const selectedId = selectedLot?.id;
      if (result.length === 0) {
        setSelectedLot(null);
      } else if (!selectedId) {
        setSelectedLot(result[0]);
      } else {
        const matching = result.find((lot) => lot.id === selectedId);
        setSelectedLot(matching || result[0]);
      }
      setError(null);
    } catch (requestError) {
      setError(getFriendlyMessage(requestError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadLots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBaseUrl]);

  useEffect(() => {
    coordinatesRef.current = coordinatesByLotId;
  }, [coordinatesByLotId]);

  useEffect(() => {
    if (lots.length === 0) {
      setGeocodeStatus("idle");
      return;
    }

    const unresolved = lots.filter((lot) => !coordinatesRef.current[lot.id]);
    if (unresolved.length === 0) {
      setGeocodeStatus("ready");
      return;
    }

    let cancelled = false;

    async function resolveMissingCoordinates() {
      setGeocodeStatus("resolving");
      const updates: Record<string, Coordinates> = {};

      for (const lot of unresolved) {
        if (cancelled) {
          return;
        }

        const staticCoordinates = getStaticLotCoordinates(lot);
        if (staticCoordinates) {
          updates[lot.id] = staticCoordinates;
          continue;
        }

        try {
          const geocoded = await geocodeLotLocation(lot, {
            enabled: geocodeEnabled,
            endpoint: geocodeEndpoint,
            countryCodes: geocodeCountryCodes,
          });
          if (geocoded) {
            updates[lot.id] = geocoded;
          }
        } catch {
          // Keep deterministic fallback in rendering. Retry happens on next refresh/load.
        }

        if (geocodeEnabled) {
          await new Promise((resolve) => {
            setTimeout(resolve, 300);
          });
        }
      }

      if (!cancelled && Object.keys(updates).length > 0) {
        setCoordinatesByLotId((previous) => ({
          ...previous,
          ...updates,
        }));
      }

      if (!cancelled) {
        setGeocodeStatus("ready");
      }
    }

    void resolveMissingCoordinates();

    return () => {
      cancelled = true;
    };
  }, [geocodeCountryCodes, geocodeEnabled, geocodeEndpoint, lots]);

  const visibleLots = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    const filtered = lots.filter((lot) => {
      if (!lotMatchesFilter(lot, availabilityFilter)) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      return (
        lot.name.toLowerCase().includes(normalizedQuery) ||
        lot.location.toLowerCase().includes(normalizedQuery) ||
        lot.id.toLowerCase().includes(normalizedQuery)
      );
    });

    return sortLots(filtered, sortMode);
  }, [availabilityFilter, lots, query, sortMode]);

  const mapCenter = useMemo(() => {
    const baseLots = mode === "browse" ? (visibleLots.length > 0 ? visibleLots : lots) : lots;
    const points = baseLots.map(getResolvedCoordinates);
    if (mode === "create" && createCoordinates) {
      points.unshift(createCoordinates);
    }
    return getMapCenterFromCoordinates(points);
  }, [coordinatesByLotId, createCoordinates, lots, mode, visibleLots]);

  const browseSelectedCoordinates = useMemo(
    () => (selectedLot ? getResolvedCoordinates(selectedLot) : null),
    [coordinatesByLotId, selectedLot],
  );

  useEffect(() => {
    if (!selectedLot) {
      return;
    }
    setManageAvailableSpots(selectedLot.available_spots);
  }, [selectedLot]);

  async function handleCreateMapPick(coordinates: Coordinates) {
    setCreateCoordinates(coordinates);
    setCreateError(null);
    setCreateMessage(null);

    const lat = coordinates[0].toFixed(6);
    const lng = coordinates[1].toFixed(6);
    setCreateLocation(`${lat}, ${lng}`);

    const requestId = reverseLookupRequestRef.current + 1;
    reverseLookupRequestRef.current = requestId;
    setReverseLookupBusy(true);

    try {
      const displayName = await reverseGeocodeCoordinates(coordinates, {
        endpoint: reverseGeocodeEndpoint,
      });
      if (requestId !== reverseLookupRequestRef.current) {
        return;
      }

      if (displayName) {
        setCreateLocation(`${displayName} (${lat}, ${lng})`);
      }
    } catch {
      // Keep numeric coordinates already set in location input.
    } finally {
      if (requestId === reverseLookupRequestRef.current) {
        setReverseLookupBusy(false);
      }
    }
  }

  async function handleCreateLot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateError(null);
    setCreateMessage(null);

    if (createName.trim().length < 2) {
      setCreateError("Parking lot name must contain at least 2 characters.");
      return;
    }

    if (createCapacity <= 0) {
      setCreateError("Capacity must be greater than 0.");
      return;
    }

    if (createAvailable < 0 || createAvailable > createCapacity) {
      setCreateError("Available spots must be between 0 and capacity.");
      return;
    }

    if (!createLocation.trim()) {
      setCreateError("Pick a location on the map or enter location manually.");
      return;
    }

    setCreateBusy(true);
    try {
      const created = await api.createParkingLot({
        name: createName.trim(),
        location: createLocation.trim(),
        capacity: createCapacity,
        available_spots: createAvailable,
      });

      setCreateMessage(`Parking lot '${created.name}' created successfully.`);
      setSelectedLot(created);
      setCreateName("");
      setCreateCoordinates(null);
      await loadLots({ background: true });
    } catch (requestError) {
      setCreateError(getFriendlyMessage(requestError));
    } finally {
      setCreateBusy(false);
    }
  }

  function upsertLot(updatedLot: ParkingLot) {
    setLots((previous) => {
      const index = previous.findIndex((lot) => lot.id === updatedLot.id);
      if (index === -1) {
        return [updatedLot, ...previous];
      }
      const next = [...previous];
      next[index] = updatedLot;
      return next;
    });
    setSelectedLot(updatedLot);
  }

  async function handleRefreshSelectedLot() {
    if (!selectedLot) {
      setManageError("Select parking lot first.");
      return;
    }

    setManageBusy(true);
    setManageError(null);
    setManageMessage(null);
    try {
      const fresh = await api.getParkingLot(selectedLot.id);
      upsertLot(fresh);
      setManageMessage("Parking lot details refreshed.");
    } catch (requestError) {
      setManageError(getFriendlyMessage(requestError));
    } finally {
      setManageBusy(false);
    }
  }

  async function handleUpdateAvailability(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedLot) {
      setManageError("Select parking lot first.");
      return;
    }

    if (
      !Number.isFinite(manageAvailableSpots) ||
      manageAvailableSpots < 0 ||
      manageAvailableSpots > selectedLot.capacity
    ) {
      setManageError(`Available spots must be between 0 and ${selectedLot.capacity}.`);
      return;
    }

    setManageBusy(true);
    setManageError(null);
    setManageMessage(null);
    try {
      const updated = await api.updateParkingAvailability(selectedLot.id, manageAvailableSpots);
      upsertLot(updated);
      setManageMessage(`Availability updated to ${updated.available_spots}.`);
    } catch (requestError) {
      setManageError(getFriendlyMessage(requestError));
    } finally {
      setManageBusy(false);
    }
  }

  async function handleDeleteSelectedLot() {
    if (!selectedLot) {
      setManageError("Select parking lot first.");
      return;
    }

    const accepted = window.confirm(`Delete parking lot "${selectedLot.name}"?`);
    if (!accepted) {
      return;
    }

    const lotId = selectedLot.id;
    const lotName = selectedLot.name;
    setManageBusy(true);
    setManageError(null);
    setManageMessage(null);

    try {
      await api.deleteParkingLot(lotId);
      setLots((previous) => {
        const remaining = previous.filter((lot) => lot.id !== lotId);
        setSelectedLot((current) => {
          if (!current || current.id !== lotId) {
            return current;
          }
          return remaining[0] || null;
        });
        return remaining;
      });
      setCoordinatesByLotId((previous) => {
        if (!previous[lotId]) {
          return previous;
        }
        const next = { ...previous };
        delete next[lotId];
        return next;
      });
      setManageMessage(`Parking lot '${lotName}' deleted.`);
    } catch (requestError) {
      setManageError(getFriendlyMessage(requestError));
    } finally {
      setManageBusy(false);
    }
  }

  if (mode === "create") {
    return (
      <div className="parking-app">
        <section className="parking-toolbar">
          <div className="parking-toolbar-left">
            <h2>
              <Plus size={19} /> Create Parking Lot
            </h2>
            <p>Pick location on the map, fill details, and create a new parking lot.</p>
            <p className="parking-geocode-note">
              Click on map to auto-fill location. Reverse geocoding uses OpenStreetMap Nominatim.
            </p>
          </div>
          <button type="button" onClick={() => loadLots({ background: true })} disabled={refreshing}>
            {refreshing ? <LoaderCircle size={16} className="spin" /> : <RefreshCw size={16} />}
            Refresh lots
          </button>
        </section>

        <section className="parking-create-grid">
          <form className="parking-create-form-card" onSubmit={handleCreateLot}>
            <h3>Create Form</h3>

            <label htmlFor="create-parking-name">Name</label>
            <input
              id="create-parking-name"
              type="text"
              value={createName}
              onChange={(event) => setCreateName(event.target.value)}
              placeholder="City Center Garage"
              required
            />

            <label htmlFor="create-parking-location">Location</label>
            <input
              id="create-parking-location"
              type="text"
              value={createLocation}
              onChange={(event) => setCreateLocation(event.target.value)}
              placeholder="Auto-filled from map click"
              required
            />

            <div className="parking-create-inline-grid">
              <div>
                <label htmlFor="create-parking-capacity">Capacity</label>
                <input
                  id="create-parking-capacity"
                  type="number"
                  min={1}
                  value={createCapacity}
                  onChange={(event) => setCreateCapacity(Number(event.target.value))}
                  required
                />
              </div>
              <div>
                <label htmlFor="create-parking-available">Available Spots</label>
                <input
                  id="create-parking-available"
                  type="number"
                  min={0}
                  value={createAvailable}
                  onChange={(event) => setCreateAvailable(Number(event.target.value))}
                  required
                />
              </div>
            </div>

            <button type="submit" disabled={createBusy || reverseLookupBusy}>
              {createBusy ? <LoaderCircle size={16} className="spin" /> : <Plus size={15} />}
              Create parking lot
            </button>

            {createMessage ? <p className="parking-create-message success">{createMessage}</p> : null}
            {createError ? <p className="parking-create-message error">{createError}</p> : null}
          </form>

          <div className="parking-create-map-panel">
            <div className="parking-create-map-help">
              <Navigation size={15} />
              <span>
                Click map to select location
                {reverseLookupBusy ? " (resolving address...)" : ""}
              </span>
            </div>

            <MapContainer center={mapCenter} zoom={13} scrollWheelZoom className="parking-map">
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {lots.map((lot) => {
                const coordinates = getResolvedCoordinates(lot);
                return (
                  <CircleMarker
                    key={lot.id}
                    center={coordinates}
                    radius={6}
                    pathOptions={{
                      color: getAvailabilityColor(lot),
                      fillColor: getAvailabilityColor(lot),
                      fillOpacity: 0.45,
                      weight: 2,
                    }}
                  >
                    <Popup>
                      <strong>{lot.name}</strong>
                      <br />
                      {lot.location}
                    </Popup>
                  </CircleMarker>
                );
              })}

              <MapClickPicker selectedCoordinates={createCoordinates} onPick={handleCreateMapPick} />
              <MapFlyToSelection coordinates={createCoordinates} />
            </MapContainer>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="parking-app">
      <section className="parking-toolbar">
        <div className="parking-toolbar-left">
          <h2>
            <MapPinned size={19} /> Parking Lots
          </h2>
          <p>Search and explore parking locations on map. Reserve directly without manual IDs.</p>
          <p className="parking-geocode-note">
            {geocodeEnabled
              ? geocodeStatus === "resolving"
                ? "Map geocoding: resolving addresses via OpenStreetMap..."
                : "Map geocoding: active (OpenStreetMap + cache)"
              : "Map geocoding: disabled, fallback positions only"}
          </p>
        </div>
        <button type="button" onClick={() => loadLots({ background: true })} disabled={refreshing}>
          {refreshing ? <LoaderCircle size={16} className="spin" /> : <RefreshCw size={16} />}
          Refresh
        </button>
      </section>

      <section className="parking-filter-grid">
        <label>
          <Search size={15} /> Search
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Name, location or ID"
          />
        </label>

        <label>
          <Filter size={15} /> Availability
          <select
            value={availabilityFilter}
            onChange={(event) => setAvailabilityFilter(event.target.value as AvailabilityFilter)}
          >
            <option value="all">All</option>
            <option value="high">Many spots</option>
            <option value="medium">Limited</option>
            <option value="low">Almost full</option>
          </select>
        </label>

        <label>
          <LocateFixed size={15} /> Sort
          <select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}>
            <option value="name">Name A-Z</option>
            <option value="free-desc">Free spots high-low</option>
            <option value="free-asc">Free spots low-high</option>
            <option value="capacity-desc">Capacity high-low</option>
          </select>
        </label>
      </section>

      {error ? (
        <div className="parking-error-box">
          <p>{error}</p>
          <button type="button" onClick={() => loadLots()}>Retry</button>
        </div>
      ) : null}

      <section className="parking-main-grid">
        <div className="parking-list-panel">
          {loading ? (
            <LotSkeleton />
          ) : visibleLots.length === 0 ? (
            <div className="parking-empty-state">
              <h3>No parking lots found</h3>
              <p>Try a different search/filter combination or create a new parking lot.</p>
            </div>
          ) : (
            <div className="parking-list">
              {visibleLots.map((lot) => {
                const selected = selectedLot?.id === lot.id;
                const availabilityLevel = getAvailabilityLevel(lot);
                return (
                  <article
                    key={lot.id}
                    className={`parking-card ${selected ? "selected" : ""}`}
                    onClick={() => {
                      setSelectedLot(lot);
                    }}
                  >
                    <div className="parking-card-header">
                      <h3>{lot.name}</h3>
                      <span className={`availability-badge ${availabilityLevel}`}>{getAvailabilityLabel(lot)}</span>
                    </div>
                    <p className="parking-location">{lot.location}</p>
                    <div className="parking-metrics">
                      <span>Capacity: {lot.capacity}</span>
                      <span>Free: {lot.available_spots}</span>
                    </div>
                    <div className="parking-card-actions">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onReserveLot(lot);
                        }}
                      >
                        Reserve
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <div className="parking-map-panel">
          <MapContainer center={mapCenter} zoom={13} scrollWheelZoom className="parking-map">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {visibleLots.map((lot) => {
              const coordinates = getResolvedCoordinates(lot);
              const selected = selectedLot?.id === lot.id;
              return (
                <CircleMarker
                  key={lot.id}
                  center={coordinates}
                  radius={selected ? 11 : 8}
                  pathOptions={{
                    color: getAvailabilityColor(lot),
                    fillColor: getAvailabilityColor(lot),
                    fillOpacity: selected ? 0.85 : 0.45,
                    weight: selected ? 3 : 2,
                  }}
                  eventHandlers={{
                    click: () => {
                      setSelectedLot(lot);
                    },
                  }}
                >
                  <Popup>
                    <div className="map-popup">
                      <h4>{lot.name}</h4>
                      <p>{lot.location}</p>
                      <p>Capacity: {lot.capacity}</p>
                      <p>Free spots: {lot.available_spots}</p>
                      <button type="button" onClick={() => onReserveLot(lot)}>
                        Reserve this lot
                      </button>
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}

            <MapFlyToSelection coordinates={browseSelectedCoordinates} />
          </MapContainer>
        </div>
      </section>

      {session.user ? (
        <section className="parking-admin-panel">
          <h3>
            <Settings2 size={17} /> Manage Selected Parking
          </h3>

          {!selectedLot ? (
            <p className="parking-auth-note">Select parking lot from list or map to enable management actions.</p>
          ) : (
            <>
              <div className="parking-selected-lot-meta">
                <p>
                  <strong>{selectedLot.name}</strong>
                </p>
                <p>{selectedLot.location}</p>
                <p>
                  Lot ID: {selectedLot.id} | Capacity: {selectedLot.capacity} | Free spots: {selectedLot.available_spots}
                </p>
              </div>

              <div className="parking-admin-actions">
                <button type="button" onClick={() => void handleRefreshSelectedLot()} disabled={manageBusy}>
                  {manageBusy ? <LoaderCircle size={16} className="spin" /> : <RefreshCw size={16} />}
                  Refresh details
                </button>

                <form className="parking-admin-update-form" onSubmit={handleUpdateAvailability}>
                  <label htmlFor="selected-lot-availability">Available spots</label>
                  <input
                    id="selected-lot-availability"
                    type="number"
                    min={0}
                    max={selectedLot.capacity}
                    value={manageAvailableSpots}
                    onChange={(event) => setManageAvailableSpots(Number(event.target.value))}
                  />
                  <button type="submit" disabled={manageBusy}>
                    Update availability
                  </button>
                </form>

                <button type="button" className="danger" onClick={() => void handleDeleteSelectedLot()} disabled={manageBusy}>
                  <Trash2 size={16} /> Delete parking lot
                </button>
              </div>

              {manageMessage ? <p className="parking-manage-message success">{manageMessage}</p> : null}
              {manageError ? <p className="parking-manage-message error">{manageError}</p> : null}
            </>
          )}
        </section>
      ) : null}

      {!session.user ? (
        <p className="parking-auth-note">
          You can inspect parking lots without login. Login is required for reservation flows.
        </p>
      ) : null}
    </div>
  );
}
