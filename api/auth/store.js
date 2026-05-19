import crypto from 'crypto';
import { findAuthUserByEmail, saveAuthUser, upsertUserProfile } from '../../lib/db.js';

export function hashPassword(password) {
  return crypto.createHash('sha256').update(String(password)).digest('hex');
}

export async function findUserByEmail(email = '') {
  return findAuthUserByEmail(email);
}

export async function saveUser({ name, email, password }) {
  const normalizedEmail = String(email).trim().toLowerCase();
  const user = await saveAuthUser({
    name,
    email: normalizedEmail,
    passwordHash: hashPassword(password),
    provider: 'email'
  });
  await upsertUserProfile({
    id: user.id,
    name: user.name,
    email: user.email,
    picture: user.picture
  });
  return { ...user, passwordHash: user.password_hash };
}
