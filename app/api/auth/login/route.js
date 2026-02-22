import { NextResponse } from 'next/server';
import { createSessionToken, hashPassword, readDb, sanitizeUser, writeDb } from '@/lib/db';
import { sessionCookieName } from '@/lib/auth';

export async function POST(request) {
  const body = await request.json();
  const email = `${body.email || ''}`.trim().toLowerCase();
  const password = `${body.password || ''}`;

  const db = await readDb();
  const user = db.users.find((u) => u.email === email && u.passwordHash === hashPassword(password));
  if (!user) {
    return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 });
  }

  user.sessionToken = createSessionToken();
  user.updatedAt = new Date().toISOString();
  await writeDb(db);

  const response = NextResponse.json({ user: sanitizeUser(user) });
  response.cookies.set(sessionCookieName, user.sessionToken, { httpOnly: true, sameSite: 'lax', path: '/' });
  return response;
}
