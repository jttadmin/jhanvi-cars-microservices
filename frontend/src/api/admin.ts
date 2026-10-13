import { apiRequest } from './client';

export type VehicleType =
  | 'AUTO'
  | 'SEDAN'
  | 'SUV'
  | 'HATCHBACK'
  | 'LUXURY'
  | 'MUV';

export type VehicleStatus =
  | 'AVAILABLE'
  | 'IN_USE'
  | 'MAINTENANCE'
  | 'INACTIVE';

export interface AdminVehicle {
  id: string;
  driverId?: string | null;
  registrationNumber: string;
  make: string;
  model: string;
  year: number;
  type: VehicleType;
  status: VehicleStatus;
}

export interface AdminDriver {
  id: string;
  userId?: string | null;
  name: string;
  email: string;
  phone: string;
  licenseNumber: string;
  vehicleNumber: string;
  vehicleType: string;
  vehicleModel: string;
  isAvailable: boolean;
  isOnline?: boolean;
}

export interface CreateVehicleInput {
  driverId?: string | null;
  registrationNumber: string;
  make: string;
  model: string;
  year: number;
  type: VehicleType;
  status?: VehicleStatus;
}

export async function getAdminVehicles(): Promise<AdminVehicle[]> {
  return apiRequest<AdminVehicle[]>('/vehicles');
}

export async function getAdminDrivers(): Promise<AdminDriver[]> {
  return apiRequest<AdminDriver[]>('/drivers');
}

export async function createAdminVehicle(
  input: CreateVehicleInput,
): Promise<AdminVehicle> {
  return apiRequest<AdminVehicle>('/vehicles', {
    method: 'POST',
    body: input,
  });
}

export async function updateAdminVehicle(
  id: string,
  input: Omit<CreateVehicleInput, 'status'>,
): Promise<AdminVehicle> {
  return apiRequest<AdminVehicle>(`/vehicles/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: input,
  });
}

export async function updateAdminVehicleStatus(
  id: string,
  status: VehicleStatus,
): Promise<AdminVehicle> {
  return apiRequest<AdminVehicle>(
    `/vehicles/${encodeURIComponent(id)}/status`,
    {
      method: 'PATCH',
      body: { status },
    },
  );
}
