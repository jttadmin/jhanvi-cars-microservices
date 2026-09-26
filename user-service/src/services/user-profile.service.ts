import type {
  UpdateUserProfileInput
} from '../validation/user-profile.schema';

import type {
  UserProfile,
  UserProfileRepository
} from '../repositories/user-profile.repository';

export class UserProfileService {
  private readonly repository: UserProfileRepository;

  constructor(repository: UserProfileRepository) {
    this.repository = repository;
  }

  async getMyProfile(
    userId: string
  ): Promise<UserProfile | null> {
    return this.repository.findByUserId(userId);
  }

  async updateMyProfile(
    userId: string,
    input: UpdateUserProfileInput
  ): Promise<UserProfile> {
    return this.repository.upsert(
      userId,
      input
    );
  }
}
