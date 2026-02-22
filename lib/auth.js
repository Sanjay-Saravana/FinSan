import { cookies } from 'next/headers';
import { readDb } from './db';

const COOKIE_NAME = 'finsan_session';

export function getSessionCookieStore() {
  return cookies();
}

export async function getCurrentUser() {
  const store = getSessionCookieStore();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const db = await readDb();
  const user = db.users.find((u) => u.sessionToken === token);
  return user || null;
}

export const sessionCookieName = COOKIE_NAME;
