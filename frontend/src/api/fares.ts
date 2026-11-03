import { apiRequest } from './client';
import type { FareRule, RideType } from '../utils/fare';

/** Current rates. Public, so prices show before login. */
export async function getFareRules(): Promise<FareRule[]> {
  return apiRequest<FareRule[]>('/bookings/fare-rules', { auth: false });
}

export type FareRuleInput = Omit<FareRule, 'vehicleType' | 'updatedBy' | 'updatedAt'>;

/** Admin only. */
export async function updateFareRule(
  vehicleType: RideType,
  input: FareRuleInput,
): Promise<FareRule> {
  return apiRequest<FareRule>(`/bookings/fare-rules/${vehicleType}`, {
    method: 'PUT',
    body: input,
  });
}
