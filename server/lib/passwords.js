import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { config } from '../config.js';

const BCRYPT_PREFIX = /^\$2[aby]\$\d{2}\$/;

export function isHashed(stored) {
  return typeof stored === 'string' && BCRYPT_PREFIX.test(stored);
}

export function hashPassword(plain) {
  return bcrypt.hash(plain, config.bcryptRounds);
}

function timingSafeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  // timingSafeEqual throws on length mismatch, so compare digests of equal size.
  const leftDigest = crypto.createHash('sha256').update(left).digest();
  const rightDigest = crypto.createHash('sha256').update(right).digest();
  return crypto.timingSafeEqual(leftDigest, rightDigest);
}

/**
 * Verifies a password against whatever is stored, which may still be a
 * plaintext value from before hashing existed.
 *
 * Returns `needsUpgrade: true` when the stored value was plaintext, so the
 * caller can rewrite the row as a hash. Existing accounts keep working and the
 * plaintext disappears the first time the user signs in.
 */
export async function verifyPassword(plain, stored) {
  if (!stored) return { valid: false, needsUpgrade: false };

  if (isHashed(stored)) {
    return { valid: await bcrypt.compare(plain, stored), needsUpgrade: false };
  }

  const valid = timingSafeEqual(plain, stored);
  return { valid, needsUpgrade: valid };
}
