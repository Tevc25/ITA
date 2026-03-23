import type { ParkingLot } from "./types";

const DEFAULT_CENTER: [number, number] = [46.0569, 14.5058];
const LAT_RANGE = 0.11;
const LNG_RANGE = 0.16;
const GEOCODE_CACHE_KEY = "ita.smartparking.geocode-cache.v1";

type Coordinates = [number, number];

interface CachedGeocodeEntry {
  lat: number;
  lng: number;
}

type GeocodeCache = Record<string, CachedGeocodeEntry>;

function normalizeLocation(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function readGeocodeCache(): GeocodeCache {
  if (typeof localStorage === "undefined") {
    return {};
  }

  const raw = localStorage.getItem(GEOCODE_CACHE_KEY);
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as GeocodeCache;
    if (!parsed || typeof parsed !== "object") {
      return {};
    }
    return parsed;
  } catch {
    return {};
  }
}

function writeGeocodeCache(cache: GeocodeCache): void {
  if (typeof localStorage === "undefined") {
    return;
  }
  localStorage.setItem(GEOCODE_CACHE_KEY, JSON.stringify(cache));
}

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function parseCoordinatePair(location: string): [number, number] | null {
  const match = location.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
  if (!match) {
    return null;
  }

  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return null;
  }

  return [lat, lng];
}

export function getFallbackLotCoordinates(lot: ParkingLot): Coordinates {
  const hash = hashString(`${lot.id}-${lot.name}-${lot.location}`);
  const latOffset = ((hash % 1000) / 1000 - 0.5) * LAT_RANGE;
  const lngOffset = (((hash / 1000) % 1000) / 1000 - 0.5) * LNG_RANGE;

  return [DEFAULT_CENTER[0] + latOffset, DEFAULT_CENTER[1] + lngOffset];
}

export function getStaticLotCoordinates(lot: ParkingLot): Coordinates | null {
  if (typeof lot.latitude === "number" && typeof lot.longitude === "number") {
    return [lot.latitude, lot.longitude];
  }

  const parsed = parseCoordinatePair(lot.location);
  if (parsed) {
    return parsed;
  }

  return null;
}

export function getLotCoordinates(lot: ParkingLot): Coordinates {
  return getStaticLotCoordinates(lot) ?? getFallbackLotCoordinates(lot);
}

export async function geocodeLotLocation(
  lot: ParkingLot,
  options: {
    enabled?: boolean;
    endpoint?: string;
    countryCodes?: string;
  } = {},
): Promise<Coordinates | null> {
  if (options.enabled === false) {
    return null;
  }

  const location = lot.location.trim();
  if (!location) {
    return null;
  }

  const normalized = normalizeLocation(location);
  const cache = readGeocodeCache();
  const fromCache = cache[normalized];
  if (fromCache) {
    return [fromCache.lat, fromCache.lng];
  }

  const endpoint = options.endpoint || "https://nominatim.openstreetmap.org/search";
  const url = new URL(endpoint);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("q", location);
  if (options.countryCodes) {
    url.searchParams.set("countrycodes", options.countryCodes);
  }

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as Array<{ lat?: string; lon?: string }>;
  const first = payload[0];
  if (!first || typeof first.lat !== "string" || typeof first.lon !== "string") {
    return null;
  }

  const lat = Number(first.lat);
  const lng = Number(first.lon);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  const nextCache: GeocodeCache = {
    ...cache,
    [normalized]: { lat, lng },
  };
  writeGeocodeCache(nextCache);

  return [lat, lng];
}

export async function reverseGeocodeCoordinates(
  coordinates: Coordinates,
  options: {
    endpoint?: string;
  } = {},
): Promise<string | null> {
  const endpoint = options.endpoint || "https://nominatim.openstreetmap.org/reverse";
  const url = new URL(endpoint);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", String(coordinates[0]));
  url.searchParams.set("lon", String(coordinates[1]));

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
    },
  });
  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as { display_name?: string };
  if (!payload.display_name || typeof payload.display_name !== "string") {
    return null;
  }
  return payload.display_name;
}

export async function resolveLotCoordinates(
  lot: ParkingLot,
  options: {
    geocodeEnabled?: boolean;
    geocodeEndpoint?: string;
    geocodeCountryCodes?: string;
  } = {},
): Promise<Coordinates> {
  const direct = getStaticLotCoordinates(lot);
  if (direct) {
    return direct;
  }

  const geocoded = await geocodeLotLocation(lot, {
    enabled: options.geocodeEnabled,
    endpoint: options.geocodeEndpoint,
    countryCodes: options.geocodeCountryCodes,
  });

  if (geocoded) {
    return geocoded;
  }

  return getFallbackLotCoordinates(lot);
}

export function getMapCenterFromCoordinates(points: Coordinates[]): Coordinates {
  if (points.length === 0) {
    return DEFAULT_CENTER;
  }

  const sum = points.reduce(
    (accumulator, point) => [accumulator[0] + point[0], accumulator[1] + point[1]],
    [0, 0],
  );

  return [sum[0] / points.length, sum[1] / points.length];
}

export function getMapCenter(lots: ParkingLot[]): Coordinates {
  if (lots.length === 0) {
    return DEFAULT_CENTER;
  }

  return getMapCenterFromCoordinates(lots.map(getLotCoordinates));
}
