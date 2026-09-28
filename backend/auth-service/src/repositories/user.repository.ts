import { getDb } from '../config/db';
import { UserRecord, UserRole } from '../models/user.model';

// The ONLY place in this service that writes raw table/column names.
// Controllers and services never touch `db` directly.
const TABLE = 'users';

export interface CreateUserInput {
  fullName: string;
  email: string;
  mobileNumber: string;
  passwordHash: string;
  role: UserRole;
}

export interface UpdateUserInput {
  email?: string;
  mobileNumber?: string;
}

export const userRepository = {
  async findByEmail(email: string): Promise<UserRecord | undefined> {
    return getDb()<UserRecord>(TABLE).where({ email }).first();
  },

  async findByMobileNumber(mobileNumber: string): Promise<UserRecord | undefined> {
    return getDb()<UserRecord>(TABLE)
      .where({ mobile_number: mobileNumber })
      .first();
  },

  async findById(id: string): Promise<UserRecord | undefined> {
    return getDb()<UserRecord>(TABLE).where({ id }).first();
  },

  async updateById(id: string, input: UpdateUserInput): Promise<UserRecord> {
    const updates: Record<string, string> = {};

    if (input.email !== undefined) {
      updates.email = input.email;
    }

    if (input.mobileNumber !== undefined) {
      updates.mobile_number = input.mobileNumber;
    }

    const [row] = await getDb()<UserRecord>(TABLE)
      .where({ id })
      .update({
        ...updates,
        updated_at: getDb().fn.now(),
      })
      .returning('*');

    return row;
  },

  async create(input: CreateUserInput): Promise<UserRecord> {
    const [row] = await getDb()<UserRecord>(TABLE)
      .insert({
        full_name: input.fullName,
        email: input.email,
        mobile_number: input.mobileNumber,
        password_hash: input.passwordHash,
        role: input.role,
      })
      .returning('*');

    return row;
  },
};