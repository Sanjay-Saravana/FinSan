import { NextResponse } from 'next/server';
import { getCurrentUser, sessionCookieName } from '@/lib/auth';
import { readDb, sanitizeUser, writeDb } from '@/lib/db';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ user: null });
  return NextResponse.json({ user: sanitizeUser(user) });
}

export async function DELETE() {
  const user = await getCurrentUser();
  if (user) {
    const db = await readDb();
    const found = db.users.find((u) => u.id === user.id);
    if (found) {
      found.sessionToken = null;
      found.updatedAt = new Date().toISOString();
      await writeDb(db);
    }
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(sessionCookieName, '', { path: '/', maxAge: 0 });
  return response;
}
