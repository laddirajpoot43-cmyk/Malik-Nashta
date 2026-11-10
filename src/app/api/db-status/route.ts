import { NextResponse } from 'next/server';
import { insforgeAdmin, INSFORGE_BASE_URL } from '@/lib/insforge';
import { localStore } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const forcePull = searchParams.get('pull') === 'true';

    if (forcePull) {
      await localStore.syncFromCloud();
    }

    const tablesToCheck = [
      'pos_settings',
      'profiles',
      'categories',
      'products',
      'product_addons',
      'vendors',
      'raw_materials',
      'orders',
      'purchase_invoices',
      'register_sessions',
      'audit_logs',
    ];

    const tableCounts: Record<string, number> = {};
    let connected = true;
    let firstError: string | null = null;

    await Promise.all(
      tablesToCheck.map(async (t) => {
        const { data, error } = await insforgeAdmin.database.from(t).select('id');
        if (error) {
          connected = false;
          if (!firstError) firstError = error.message;
          tableCounts[t] = -1;
        } else {
          tableCounts[t] = Array.isArray(data) ? data.length : 0;
        }
      })
    );

    return NextResponse.json({
      success: true,
      cloudConnected: connected,
      baseUrl: INSFORGE_BASE_URL,
      error: firstError,
      tableCounts,
      storeStatus: localStore.getCloudStatus(),
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        cloudConnected: false,
        baseUrl: INSFORGE_BASE_URL,
        error: error.message,
      },
      { status: 500 }
    );
  }
}

