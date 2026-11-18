import { localStore } from '@/lib/db';
import { jsonResponse } from '@/lib/api-response';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const store = await localStore.ensureFresh();

    // Active categories sorted by display_order
    const categories = (store.categories || [])
      .filter((c: any) => c.is_active !== false)
      .sort((a: any, b: any) => (a.display_order || 0) - (b.display_order || 0));

    // Available products joined with category names
    const products = (store.products || [])
      .filter((p: any) => p.is_active !== false && p.availability !== 'inactive' && p.availability !== 'hidden')
      .map((p: any) => {
        const cat = (store.categories || []).find((c: any) => c.id === p.category_id);
        return {
          ...p,
          category_name: cat ? cat.name : (p.category_name || 'Nashta'),
        };
      })
      .sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0));

    // Active addons
    const addons = (store.product_addons || []).filter((a: any) => a.is_active !== false);

    const quickNotes = [
      'Mirch kam',
      'Oil kam',
      'Extra crispy',
      'Chai strong',
      'Meetha tez',
      'Kam cheeni',
      'Garam garam',
      'Bina pyaz',
      'Packing kardo',
    ];

    const paymentMethods = [
      { id: 'cash', name: 'Cash (Naqad)' },
      { id: 'jazzcash', name: 'JazzCash Digital' },
      { id: 'easypaisa', name: 'EasyPaisa Digital' },
      { id: 'bank', name: 'Bank Transfer / Card' },
    ];

    // Find currently active open cash register session
    const activeRegister = (store.register_sessions || []).find((s: any) => s.status === 'open') || null;

    // Count currently held orders
    const heldOrdersCount = (store.held_orders || []).filter((h: any) => h.status === 'held').length;

    // Get current POS settings
    const settings = store.pos_settings?.[0] || null;

    return jsonResponse({
      success: true,
      categories,
      products,
      addons,
      quickNotes,
      paymentMethods,
      activeRegister,
      heldOrdersCount,
      settings,
      cloudStatus: localStore.getCloudStatus(),
    });
  } catch (error: any) {
    console.error('POS Init error:', error);
    return jsonResponse({ success: false, error: error.message }, { status: 500 });
  }
}

