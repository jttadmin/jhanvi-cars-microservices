export type UserRole = 'CUSTOMER' | 'DRIVER' | 'ADMIN';

// Shape of a row in auth_schema.users
export interface UserRecord {
  id: string;
  full_name: string;
  email: string;
  mobile_number: string;
  password_hash: string;
  role: UserRole;
  created_at: Date;
  updated_at: Date;
}

// Safe shape returned to clients - never leaks password_hash.
export interface PublicUser {
  id: string;
  fullName: string;
  email: string;
  mobileNumber: string;
  role: UserRole;
  createdAt: Date;
}

export function toPublicUser(user: UserRecord): PublicUser {
  return {
    id: user.id,
    fullName: user.full_name,
    email: user.email,
    mobileNumber: user.mobile_number,
    role: user.role,
    createdAt: user.created_at,
  };
}
