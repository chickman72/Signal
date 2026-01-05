import { NextRequest, NextResponse } from 'next/server';
import { logEvent } from '../../dbActions';
import { ActivityEventType } from '../../types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { eventType, entry } = body as { eventType: ActivityEventType; entry: any };

    if (!eventType) {
      return NextResponse.json({ error: 'eventType is required' }, { status: 400 });
    }

    const saved = await logEvent(eventType, entry ?? {});
    return NextResponse.json({ ok: true, id: saved.id });
  } catch (error) {
    console.error('Failed to log activity', error);
    return NextResponse.json({ error: 'Failed to log activity' }, { status: 500 });
  }
}
