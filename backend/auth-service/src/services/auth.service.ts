import bcrypt from 'bcrypt';
import { ConflictError, NotFoundError, UnauthorizedError } from '../errors/AppError';
import { toPublicUser, PublicUser } from '../models/user.model';
import { userRepository } from '../repositories/user.repository';
import {
  RegisterInput,
  LoginInput,
  UpdateProfileInput,
} from '../validators/auth.validator';
import { tokenProvider } from './token.service';
import { initializeUserProfile } from './user-profile.client';
import { createDriverProfile } from './driver-profile.client';

const SALT_ROUNDS = 10;

export const authService = {
  async register(input: RegisterInput): Promise<{ user: PublicUser; token: string }> {
    const existingEmail = await userRepository.findByEmail(input.email);
    if (existingEmail) {
      throw new ConflictError('Email is already registered');
    }
    const existingMobile = await userRepository.findByMobileNumber(input.mobileNumber);
    if (existingMobile) {
      throw new ConflictError('Mobile number is already registered');
    }

    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
    const created = await userRepository.create({
      fullName: input.fullName,
      email: input.email,
      mobileNumber: input.mobileNumber,
      passwordHash,
      role: input.role,
    });

    const token = await tokenProvider.issue({ sub: created.id, role: created.role });

    await initializeUserProfile({
      userId: created.id,
      displayName: created.full_name,
      token,
    });

    if (created.role === 'DRIVER') {
      if (
        !input.licenseNumber ||
        !input.vehicleNumber ||
        !input.vehicleType ||
        !input.vehicleModel
      ) {
        throw new ConflictError(
          'Driver registration requires licenseNumber, vehicleNumber, vehicleType and vehicleModel',
        );
      }

      await createDriverProfile({
        userId: created.id,
        fullName: created.full_name,
        email: created.email,
        mobileNumber: created.mobile_number,
        licenseNumber: input.licenseNumber,
        vehicleNumber: input.vehicleNumber,
        vehicleType: input.vehicleType,
        vehicleModel: input.vehicleModel,
      });
    }

    return { user: toPublicUser(created), token };
  },

  async login(input: LoginInput): Promise<{ user: PublicUser; token: string }> {
    const existing = input.identifier.includes('@')
      ? await userRepository.findByEmail(input.identifier)
      : await userRepository.findByMobileNumber(input.identifier);
    if (!existing) {
      throw new UnauthorizedError("Account doesn't exist. Please sign up.");
    }

    const passwordMatches = await bcrypt.compare(input.password, existing.password_hash);
    if (!passwordMatches) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const token = await tokenProvider.issue({ sub: existing.id, role: existing.role });
    return { user: toPublicUser(existing), token };
  },


  async updateProfile(
    userId: string,
    input: UpdateProfileInput,
  ): Promise<PublicUser> {
    const currentUser = await userRepository.findById(userId);

    if (!currentUser) {
      throw new NotFoundError('User not found');
    }

    if (input.email !== undefined && input.email !== currentUser.email) {
      const existingEmail = await userRepository.findByEmail(input.email);

      if (existingEmail && existingEmail.id !== userId) {
        throw new ConflictError('Email is already registered');
      }
    }

    if (
      input.mobileNumber !== undefined &&
      input.mobileNumber !== currentUser.mobile_number
    ) {
      const existingMobile = await userRepository.findByMobileNumber(
        input.mobileNumber,
      );

      if (existingMobile && existingMobile.id !== userId) {
        throw new ConflictError('Mobile number is already registered');
      }
    }

    const updated = await userRepository.updateById(userId, input);

    return toPublicUser(updated);
  },

  async getById(userId: string): Promise<PublicUser> {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    return toPublicUser(user);
  },
};
