'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { CashierHeader } from '@/components/CashierHeader';
import { AdminSidebar } from '@/components/admin/AdminSidebar';

export const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const pathname = usePathname();

  const isAdminRoute =
    pathname.startsWith('/admin') ||
    pathname.startsWith('/purchases') ||
    pathname.startsWith('/vendors') ||
    pathname.startsWith('/daily-summary') ||
    pathname.startsWith('/reports') ||
    pathname.startsWith('/settings') ||
    pathname.startsWith('/audit-logs') ||
    pathname.startsWith('/orders') ||
    pathname.startsWith('/register');

  if (isAdminRoute) {
    return (
      <div className="flex h-screen w-full overflow-hidden bg-slate-100 text-slate-900">
        <React.Suspense fallback={<aside className="w-64 lg:w-72 bg-white border-r border-slate-200 shrink-0 h-screen" />}>
          <AdminSidebar />
        </React.Suspense>
        <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
          <main className="flex-1 p-2.5 sm:p-3.5 max-w-[1700px] w-full mx-auto">
            {children}
          </main>
        </div>
      </div>
    );
  }

  // Cashier POS counter layout
  return (
    <div className="flex flex-col h-screen w-full overflow-hidden bg-slate-100 text-slate-900">
      <div className="shrink-0">
        <CashierHeader />
      </div>
      <main className="flex-1 min-h-0 w-full overflow-hidden px-2 sm:px-3 py-2 max-w-[1800px] mx-auto">
        {children}
      </main>
    </div>
  );
};
