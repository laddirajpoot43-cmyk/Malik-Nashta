import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { SettingsProvider } from '@/context/SettingsContext';
import { POSProvider } from '@/context/POSContext';
import { NavigationHeader } from '@/components/NavigationHeader';
import { RegisterModal } from '@/components/modals/RegisterModal';
import { HeldOrdersModal } from '@/components/modals/HeldOrdersModal';
import { DiscountModal } from '@/components/modals/DiscountModal';
import { PaymentModal } from '@/components/modals/PaymentModal';
import { ThermalReceiptContainer } from '@/components/ThermalReceiptContainer';

export const metadata: Metadata = {
  title: 'Malik Tasty Nashta Point - Enterprise POS & Hotel Platform',
  description: 'High-speed keyboard billing, Cash drawer shifts, Pakistani portion reciprocation, and Vendor Khata ledger.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-950 text-slate-100 min-h-screen flex flex-col antialiased selection:bg-emerald-500 selection:text-white">
        <AuthProvider>
          <SettingsProvider>
            <POSProvider>
              <div className="flex flex-col min-h-screen">
                <NavigationHeader />
                <main className="flex-1 max-w-[1700px] w-full mx-auto px-4 py-4">
                  {children}
                </main>
              </div>

              {/* Global Modals */}
              <RegisterModal />
              <HeldOrdersModal />
              <DiscountModal />
              <PaymentModal />

              {/* Dedicated 80mm Print Container */}
              <ThermalReceiptContainer />
            </POSProvider>
          </SettingsProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

