import type {
  DeleteParkingLotResponse,
  ParkingLot,
  ParkingLotListResponse,
  ParkingLotResponse,
  Reservation,
  ReservationScope,
  SessionState,
  UserProfile,
} from "./types";

export class ApiError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

function joinUrl(baseUrl: string, path: string): string {
  const base = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}

function parsePayload(raw: string): unknown {
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function extractErrorMessage(status: number, payload: unknown): string {
  if (payload && typeof payload === "object") {
    const detail = (payload as Record<string, unknown>).detail;
    const error = (payload as Record<string, unknown>).error;
    if (typeof detail === "string") {
      return detail;
    }
    if (typeof error === "string") {
      return error;
    }
  }

  return `Request failed with status ${status}`;
}

export class ApiClient {
  readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    path: string,
    options: {
      method?: string;
      body?: unknown;
      token?: string | null;
      headers?: Record<string, string>;
      useBaseUrl?: boolean;
    } = {},
  ): Promise<T> {
    const headers: Record<string, string> = {
      Accept: "application/json",
      ...(options.headers || {}),
    };

    if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    if (options.token) {
      headers.Authorization = options.token.startsWith("Bearer ")
        ? options.token
        : `Bearer ${options.token}`;
    }

    const requestUrl = options.useBaseUrl === false ? path : joinUrl(this.baseUrl, path);
    const response = await fetch(requestUrl, {
      method: options.method || "GET",
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });

    const text = await response.text();
    const payload = parsePayload(text);

    if (!response.ok) {
      throw new ApiError(extractErrorMessage(response.status, payload), response.status, payload);
    }

    return payload as T;
  }

  async health(healthPath = "/health"): Promise<{ status: string; service?: string; client?: string }> {
    const isAbsoluteUrl = /^https?:\/\//i.test(healthPath);
    const isRootRelativePath = healthPath.startsWith("/");
    return this.request<{ status: string; service?: string; client?: string }>(healthPath, {
      useBaseUrl: !(isAbsoluteUrl || isRootRelativePath),
    });
  }

  async register(input: { email: string; password: string; name: string }): Promise<UserProfile> {
    return this.request<UserProfile>("/auth/register", {
      method: "POST",
      body: input,
    });
  }

  async login(input: { email: string; password: string }): Promise<{ token: string }> {
    return this.request<{ token: string }>("/auth/login", {
      method: "POST",
      body: input,
    });
  }

  async me(token: string): Promise<UserProfile> {
    return this.request<UserProfile>("/me", { token });
  }

  async listParkingLots(): Promise<ParkingLot[]> {
    const payload = await this.request<ParkingLotListResponse>("/parking-lots");
    return payload.parking_lots || [];
  }

  async createParkingLot(input: {
    name: string;
    location: string;
    capacity: number;
    available_spots: number;
  }): Promise<ParkingLot> {
    const payload = await this.request<ParkingLotResponse>("/parking-lots", {
      method: "POST",
      body: input,
    });
    return payload.parking_lot;
  }

  async getParkingLot(id: string): Promise<ParkingLot> {
    const payload = await this.request<ParkingLotResponse>(`/parking-lots/${encodeURIComponent(id)}`);
    return payload.parking_lot;
  }

  async updateParkingAvailability(id: string, available_spots: number): Promise<ParkingLot> {
    const payload = await this.request<ParkingLotResponse>(`/parking-lots/${encodeURIComponent(id)}/availability`, {
      method: "PATCH",
      body: { available_spots },
    });
    return payload.parking_lot;
  }

  async deleteParkingLot(id: string): Promise<DeleteParkingLotResponse> {
    return this.request<DeleteParkingLotResponse>(`/parking-lots/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  }

  async createReservation(input: {
    user_id: string;
    parking_lot_id: string;
    vehicle_plate: string;
    start_time: string;
    end_time: string;
  }): Promise<Reservation> {
    return this.request<Reservation>("/reservations", {
      method: "POST",
      body: input,
    });
  }

  async cancelReservation(reservationId: string, userId: string): Promise<Reservation> {
    return this.request<Reservation>(`/reservations/${encodeURIComponent(reservationId)}/cancel`, {
      method: "POST",
      body: { user_id: userId },
    });
  }

  async getReservation(reservationId: string): Promise<Reservation> {
    return this.request<Reservation>(`/reservations/${encodeURIComponent(reservationId)}`);
  }

  async listUserReservations(userId: string, scope: ReservationScope): Promise<Reservation[]> {
    return this.request<Reservation[]>(
      `/users/${encodeURIComponent(userId)}/reservations?scope=${encodeURIComponent(scope)}`,
    );
  }

  async buildSession(email: string, password: string): Promise<SessionState> {
    const login = await this.login({ email, password });
    const user = await this.me(login.token);
    return {
      token: login.token,
      user,
    };
  }
}
