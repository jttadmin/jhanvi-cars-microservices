import { apiRequest } from './client';

export async function setAvailability(isAvailable: boolean): Promise<void> {
  await apiRequest<void>('/drivers/me/status', {
    method: 'PATCH',
    body: { isAvailable },
  });
}

// Driver profile / vehicle info is read from GET /api/auth/me (see
// AuthUser.vehicle) rather than a separate drivers endpoint, since none
// was specified for that. Swap DriverDashboard over to a dedicated
// GET /api/drivers/me here if/when the backend adds one.

    
export interface DriverProfile {
  id: string;
  userId?: string | null;
  name: string;
  email: string;
  phone: string;
  licenseNumber: string;
  vehicleNumber: string;
  vehicleType: 'AUTO' | 'ECONOMY' | 'COMFORT' | 'COMFORT_PLUS';
  vehicleModel: string;
  isAvailable: boolean;
  isOnline?: boolean;
  latitude?: number | null;
  longitude?: number | null;
  lastLocationAt?: string | null;
  rating?: {
    averageRating: number;
    totalRatings: number;
  };
  earnings?: {
    totalTrips: number;
    totalEarnings: number;
    todayTrips: number;
    todayEarnings: number;
    weekTrips: number;
    weekEarnings: number;
  };
}

export async function getDriverProfile(): Promise<DriverProfile> {
  return apiRequest<DriverProfile>('/drivers/me');
}
