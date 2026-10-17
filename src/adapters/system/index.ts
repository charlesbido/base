/** Adapters for the "system" ports: time, randomness, and password hashing. */
import { randomBytes, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { Clock, IdGenerator, PasswordHasher, TokenGenerator } from '../../ports/index.js';

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

export class UuidGenerator implements IdGenerator {
  next(): string {
    return randomUUID();
  }
}

/** 256 bits of randomness, base64url-encoded. */
export class CryptoTokenGenerator implements TokenGenerator {
  next(): string {
    return randomBytes(32).toString('base64url');
  }
}

export class BcryptPasswordHasher implements PasswordHasher {
  constructor(private readonly rounds = 10) {}
  hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, this.rounds);
  }
  verify(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }
}
