export type VehicleType =
  | "AUTO"
  | "SEDAN"
  | "SUV"
  | "HATCHBACK"
  | "LUXURY"
  | "MUV";

export type VehicleStatus =
  | "AVAILABLE"
  | "IN_USE"
  | "MAINTENANCE"
  | "INACTIVE";

export interface Vehicle {
  id: string;
  driverId?: string | null;
  registrationNumber: string;
  make: string;
  model: string;
  year: number;
  type: VehicleType;
  status: VehicleStatus;
}
