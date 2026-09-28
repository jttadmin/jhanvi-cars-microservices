import { apiRequest, setToken, clearToken } from './client';
import type { AuthUser, Role } from '../types';

interface AuthResponse {
  success: boolean;
  data: {
    token: string;
    user: AuthUser;
  };
}

interface MeResponse {
  success: boolean;
  data: {
    user: AuthUser;
  };
}

export async function register(input: {
  name: string;
  email: string;
  password: string;
  role: Role;
  mobileNumber: string;
  licenseNumber?: string;
  vehicleNumber?: string;
}): Promise<AuthUser> {
  const response = await apiRequest<AuthResponse>('/auth/register', {
    method: 'POST',
    body: {
      fullName: input.name,
      email: input.email,
      password: input.password,
      role: input.role,
      mobileNumber: input.mobileNumber,
      licenseNumber: input.licenseNumber,
      vehicleNumber: input.vehicleNumber,
    },
    auth: false,
  });

  setToken(response.data.token);
  return response.data.user;
}

export async function login(input: {
  email: string;
  password: string;
}): Promise<AuthUser> {
  const response = await apiRequest<AuthResponse>('/auth/login', {
    method: 'POST',
    body: input,
    auth: false,
  });

  setToken(response.data.token);
  return response.data.user;
}

export async function getMe(): Promise<AuthUser> {
  const response = await apiRequest<MeResponse>('/auth/me');
  return response.data.user;
}

export function logout(): void {
  clearToken();
}
