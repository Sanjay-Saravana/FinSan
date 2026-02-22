import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { readDb, writeDb } from '@/lib/db';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({ finance: user.finance });
}

export async function PUT(request) {
  const authUser = await getCurrentUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const db = await readDb();
  const user = db.users.find((u) => u.id === authUser.id);
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  user.finance = body.finance;
  user.updatedAt = new Date().toISOString();
  await writeDb(db);
  return NextResponse.json({ finance: user.finance });
}
