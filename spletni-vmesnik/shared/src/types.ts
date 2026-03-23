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
