import type { ParkingLot } from "./types";

export type AvailabilityLevel = "high" | "medium" | "low";

export function getAvailabilityRatio(lot: ParkingLot): number {
  if (lot.capacity <= 0) {
    return 0;
  }
  return lot.available_spots / lot.capacity;
}

export function getAvailabilityLevel(lot: ParkingLot): AvailabilityLevel {
  const ratio = getAvailabilityRatio(lot);
  if (ratio >= 0.5) {
    return "high";
  }
  if (ratio >= 0.2) {
    return "medium";
  }
  return "low";
}

export function getAvailabilityLabel(lot: ParkingLot): string {
  const level = getAvailabilityLevel(lot);
  if (level === "high") {
    return "Many spots";
  }
  if (level === "medium") {
    return "Limited spots";
  }
  return "Almost full";
}

export function getAvailabilityColor(lot: ParkingLot): string {
  const level = getAvailabilityLevel(lot);
  if (level === "high") {
    return "#2ec27e";
  }
  if (level === "medium") {
    return "#f6c344";
  }
  return "#eb5757";
}
