import crypto from 'node:crypto';

export const USER_COLUMNS = `
  id, email, name, phone, address, faf_id, avatar_id, role,
  posts_enabled, feeds_enabled, account_type, business_name, business_type, created_at
`;

export function serializeUser(row, provider = 'email') {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone || undefined,
    address: row.address || undefined,
    fafId: row.faf_id || undefined,
    avatarId: row.avatar_id || 'violet',
    role: row.role || 'Member',
    postsEnabled: row.posts_enabled ?? true,
    feedsEnabled: row.feeds_enabled ?? true,
    // Fixed at signup. Deliberately not patchable: it is the boundary the
    // Business product will eventually be split along, so an account must
    // belong to exactly one product for its whole life.
    accountType: row.account_type === 'business' ? 'business' : 'individual',
    businessName: row.business_name || undefined,
    businessType: row.business_type || undefined,
    provider,
  };
}

/**
 * FaF IDs are user-facing and unique. The original 4-digit random value
 * collided often enough to fail the unique constraint on a live table, so this
 * draws from a much larger space and the caller retries on conflict.
 */
export function generateFafId() {
  const alphabet = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // No I or O.
  const bytes = crypto.randomBytes(6);
  let suffix = '';
  for (const byte of bytes) suffix += alphabet[byte % alphabet.length];
  return `FAF-${suffix}`;
}

export function serializeContact(row) {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    relation: row.relationship || 'Trusted contact',
  };
}
