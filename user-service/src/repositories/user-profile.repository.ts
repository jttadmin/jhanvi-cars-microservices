import type { Knex } from 'knex';

export interface UserProfile {
  userId: string;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface UserProfileRow {
  user_id: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface UpsertUserProfileData {
  displayName?: string;
  bio?: string | null;
  avatarUrl?: string | null;
}

export interface UserProfileRepository {
  findByUserId(
    userId: string
  ): Promise<UserProfile | null>;

  upsert(
    userId: string,
    data: UpsertUserProfileData
  ): Promise<UserProfile>;
}

function mapRow(row: UserProfileRow): UserProfile {
  return {
    userId: row.user_id,
    displayName: row.display_name,
    bio: row.bio,
    avatarUrl: row.avatar_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export class PostgresUserProfileRepository
  implements UserProfileRepository
{
  private readonly db: Knex;

  constructor(db: Knex) {
    this.db = db;
  }

  async findByUserId(
    userId: string
  ): Promise<UserProfile | null> {
    const row = await this.db('user_profiles')
      .where({
        user_id: userId
      })
      .first<UserProfileRow>();

    return row ? mapRow(row) : null;
  }

  async upsert(
    userId: string,
    data: UpsertUserProfileData
  ): Promise<UserProfile> {
    const now = new Date();

    const existing = await this.db('user_profiles')
      .where({
        user_id: userId
      })
      .first<UserProfileRow>();

    if (!existing) {
      const row = {
        user_id: userId,
        display_name: data.displayName ?? null,
        bio: data.bio ?? null,
        avatar_url: data.avatarUrl ?? null,
        created_at: now,
        updated_at: now
      };

      await this.db('user_profiles').insert(row);

      return mapRow(row);
    }

    const updates: Record<string, unknown> = {
      updated_at: now
    };

    if (data.displayName !== undefined) {
      updates.display_name = data.displayName;
    }

    if (data.bio !== undefined) {
      updates.bio = data.bio;
    }

    if (data.avatarUrl !== undefined) {
      updates.avatar_url = data.avatarUrl;
    }

    await this.db('user_profiles')
      .where({
        user_id: userId
      })
      .update(updates);

    const updated = await this.db('user_profiles')
      .where({
        user_id: userId
      })
      .first<UserProfileRow>();

    if (!updated) {
      throw new Error(
        `User profile disappeared after update: ${userId}`
      );
    }

    return mapRow(updated);
  }
}
