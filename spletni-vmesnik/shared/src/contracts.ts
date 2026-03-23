import type { ParkingLot, SessionState } from "./types";

export interface AuthMfeProps {
  apiBaseUrl: string;
  session: SessionState;
  onSessionChange: (next: SessionState) => void;
}

export type ParkingMfeMode = "browse" | "create";

export interface ParkingMfeProps {
  apiBaseUrl: string;
  session: SessionState;
  onReserveLot: (lot: ParkingLot) => void;
  mode?: ParkingMfeMode;
}

export interface ReservationsMfeProps {
  apiBaseUrl: string;
  session: SessionState;
  selectedLot: ParkingLot | null;
}
