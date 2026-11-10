import { NextResponse } from 'next/server';
import { localStore, logAuditEvent, generateUUID } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const store = localStore.get();
    const profiles = (store.profiles || []).map((p: any) => ({
      id: p.id,
      email: p.email,
      full_name: p.full_name,
      display_name: p.display_name,
      role: p.role,
      status: p.status,
      pin_code: p.pin_code,
      created_at: p.created_at,
    }));
    return NextResponse.json({ success: true, users: profiles });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, full_name, display_name, role = 'cashier', pin_code = '0000', cashier_name = 'Admin' } = body;

    if (!email || !full_name) {
      return NextResponse.json({ success: false, error: 'Email and full name are required.' }, { status: 400 });
    }

    const store = localStore.get();
    if (!store.profiles) {
      store.profiles = [];
    }

    const newUser = {
      id: generateUUID(),
      email: String(email).trim(),
      full_name: String(full_name).trim(),
      display_name: display_name ? String(display_name).trim() : String(full_name).trim(),
      role,
      status: 'active',
      pin_code: String(pin_code || '0000'),
      created_at: new Date().toISOString(),
    };

    store.profiles.push(newUser);

    await logAuditEvent({
      user_name: cashier_name,
      action: 'USER_CREATED',
      entity_type: 'profile',
      entity_id: newUser.id,
      description: `Staff account created for ${newUser.full_name} (${role})`,
      new_values: { email: newUser.email, role: newUser.role, full_name: newUser.full_name },
    });

    localStore.save();

    return NextResponse.json({ success: true, user: newUser });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id, full_name, display_name, role, status, pin_code, cashier_name = 'Admin' } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'User ID is required.' }, { status: 400 });
    }

    const store = localStore.get();
    const user = (store.profiles || []).find((u: any) => u.id === id);

    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found.' }, { status: 404 });
    }

    if (full_name !== undefined) user.full_name = String(full_name).trim();
    if (display_name !== undefined) user.display_name = String(display_name).trim();
    if (role !== undefined) user.role = role;
    if (status !== undefined) user.status = status;
    if (pin_code !== undefined) user.pin_code = String(pin_code);

    await logAuditEvent({
      user_name: cashier_name,
      action: 'USER_UPDATED',
      entity_type: 'profile',
      entity_id: user.id,
      description: `Staff account updated for ${user.full_name}`,
    });

    localStore.save();

    return NextResponse.json({ success: true, user });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const cashier_name = searchParams.get('cashier_name') || 'Admin';

    if (!id) {
      return NextResponse.json({ success: false, error: 'User ID is required' }, { status: 400 });
    }

    const store = localStore.get();
    const userIndex = (store.profiles || []).findIndex((u: any) => u.id === id);

    if (userIndex === -1) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const targetUser = store.profiles[userIndex];

    // Security guard: Ensure at least one active admin remains in the system
    if (targetUser.role === 'admin') {
      const activeAdminCount = (store.profiles || []).filter((u: any) => u.role === 'admin' && u.id !== id).length;
      if (activeAdminCount === 0) {
        return NextResponse.json({
          success: false,
          error: 'Cannot delete the only remaining Admin account. Please assign another admin first.',
        }, { status: 400 });
      }
    }

    const removed = store.profiles.splice(userIndex, 1)[0];

    await logAuditEvent({
      user_name: cashier_name,
      action: 'USER_DELETED',
      entity_type: 'profile',
      entity_id: id,
      description: `Staff account "${removed.full_name}" (${removed.role}) deleted by ${cashier_name}`,
      old_values: removed,
    });

    localStore.save();
    return NextResponse.json({ success: true, deletedUser: removed });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
