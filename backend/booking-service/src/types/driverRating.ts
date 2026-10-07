export interface DriverRating {
  id: string;
  bookingId: string;
  customerId: string;
  driverId: string;
  rating: number;
  comment?: string | null;
  createdAt?: string;
  updatedAt?: string;
}
