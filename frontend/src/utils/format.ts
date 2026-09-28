import type { BookingStatus } from '../types';

export function formatStatus(status: BookingStatus): string {
  return status.charAt(0) + status.slice(1).toLowerCase();
}
