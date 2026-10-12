import { Injectable } from '@nestjs/common';
import { Facility, User } from '@prisma/client';
import { mask } from '../common/format';
import { CryptoService } from '../core/crypto.service';

export type UserWithFacility = User & { facility?: Pick<Facility, 'id' | 'name' | 'type'> | null };

/** Bentuk objek `User` sesuai docs/api_contract.md §2.2. */
@Injectable()
export class UserPresenter {
  constructor(private readonly crypto: CryptoService) {}

  present(user: UserWithFacility) {
    return {
      id: user.id,
      role: user.role,
      name: user.name,
      username: user.username,
      email: user.email,
      phone: user.phone,
      phone_verified: Boolean(user.phoneVerifiedAt),
      nik_masked: mask(this.crypto.decrypt(user.nikEncrypted)),
      birth_date: user.birthDate ? user.birthDate.toISOString().slice(0, 10) : null,
      gender: user.gender,
      avatar_url: user.avatarUrl,
      has_password: Boolean(user.passwordHash),
      facility: user.facility ? { id: user.facility.id, name: user.facility.name, type: user.facility.type } : null,
    };
  }
}
