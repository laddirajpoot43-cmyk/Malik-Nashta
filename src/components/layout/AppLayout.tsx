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
    pathname.startsWith('/orders');

  if (isAdminRoute) {
    return (
      <div className="flex min-h-screen bg-slate-100 text-slate-900">
        <React.Suspense fallback={<aside className="w-72 bg-white border-r border-slate-200" />}>
          <AdminSidebar />
        </React.Suspense>
        <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
          <main className="flex-1 p-4 md:p-6 max-w-[1600px] w-full mx-auto">
            {children}
          </main>
        </div>
      </div>
    );
  }

  // Cashier POS counter layout
  return (
    <div className="flex flex-col min-h-screen bg-slate-100 text-slate-900">
      <CashierHeader />
      <main className="flex-1 max-w-[1750px] w-full mx-auto px-2 sm:px-4 py-3">
        {children}
      </main>
    </div>
  );
};
