export type VehicleType =
  | "AUTO"
  | "ECONOMY"
  | "COMFORT"
  | "COMFORT_PLUS";

export interface Driver {
  id: string;
  userId?: string | null;
  name: string;
  email: string;
  phone: string;
  licenseNumber: string;
  vehicleNumber: string;
  vehicleType: VehicleType;
  vehicleModel: string;
  isAvailable: boolean;

  // Driver presence and live location
  isOnline?: boolean;
  latitude?: number | null;
  longitude?: number | null;
  lastLocationAt?: Date | null;
}

export interface NearbyDriver {
  driverId: string;
  distanceKm: number;
  latitude: number;
  longitude: number;
  vehicleType: VehicleType;
  vehicleModel: string;
}
