export interface UserProfile {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface SessionState {
  token: string | null;
  user: UserProfile | null;
}

export interface ParkingLot {
  id: string;
  name: string;
  location: string;
  capacity: number;
  available_spots: number;
  latitude?: number;
  longitude?: number;
}

export interface ParkingLotResponse {
  parking_lot: ParkingLot;
}

export interface ParkingLotListResponse {
  parking_lots: ParkingLot[];
}

export interface DeleteParkingLotResponse {
  success: boolean;
  message: string;
}

export interface Reservation {
  id: string;
  user_id: string;
  parking_lot_id: string;
  vehicle_plate: string;
  status: string;
  start_time: string;
  end_time: string;
  created_at: string;
  cancelled_at: string | null;
}

export type ReservationScope = "all" | "active" | "past";

export interface ServiceCircuitBreakerStatus {
  state: "closed" | "open" | "half_open";
  failure_count: number;
  failure_threshold: number;
  recovery_timeout_seconds: number;
  opened_at: string | null;
  retry_after_seconds: number | null;
}

export interface SystemServiceStatus {
  service: string;
  base_url: string;
  health_path: string;
  up: boolean;
  status: string;
  status_code: number | null;
  latency_ms: number | null;
  detail: string | null;
  circuit_breaker: ServiceCircuitBreakerStatus | null;
}

export interface SystemStatusResponse {
  status: "ok" | "degraded" | "down";
  generated_at: string;
  services: SystemServiceStatus[];
}
