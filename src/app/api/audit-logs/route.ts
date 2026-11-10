import { NextResponse } from 'next/server';
import { localStore } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const action = searchParams.get('action');

    const store = localStore.get();
    let logs = [...(store.audit_logs || [])];

    if (action) {
      logs = logs.filter((l: any) => l.action === action);
    }

    logs = logs.slice(0, limit);

    return NextResponse.json({
      success: true,
      logs,
      total: logs.length,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

