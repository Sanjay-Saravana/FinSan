import { NextResponse } from 'next/server';
import { createEmptyFinance, createSessionToken, hashPassword, readDb, sanitizeUser, writeDb } from '@/lib/db';
import { sessionCookieName } from '@/lib/auth';

export async function POST(request) {
  const body = await request.json();
  const email = `${body.email || ''}`.trim().toLowerCase();
  const password = `${body.password || ''}`;
  const name = `${body.name || ''}`.trim();
  const currency = `${body.currency || 'USD'}`;

  if (!email || password.length < 6) {
    return NextResponse.json({ error: 'Email and password (min 6 chars) are required.' }, { status: 400 });
  }

  const db = await readDb();
  if (db.users.some((u) => u.email === email)) {
    return NextResponse.json({ error: 'Email already registered.' }, { status: 409 });
  }

  const sessionToken = createSessionToken();
  const user = {
    id: crypto.randomUUID(),
    email,
    name: name || email.split('@')[0],
    passwordHash: hashPassword(password),
    sessionToken,
    finance: createEmptyFinance(currency),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.users.push(user);
  await writeDb(db);

  const response = NextResponse.json({ user: sanitizeUser(user) });
  response.cookies.set(sessionCookieName, sessionToken, { httpOnly: true, sameSite: 'lax', path: '/' });
  return response;
}
