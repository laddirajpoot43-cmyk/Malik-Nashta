import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { SettingsProvider } from '@/context/SettingsContext';
import { POSProvider } from '@/context/POSContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { RegisterModal } from '@/components/modals/RegisterModal';
import { HeldOrdersModal } from '@/components/modals/HeldOrdersModal';
import { DiscountModal } from '@/components/modals/DiscountModal';
import { PaymentModal } from '@/components/modals/PaymentModal';
import { ThermalReceiptContainer } from '@/components/ThermalReceiptContainer';

export const metadata: Metadata = {
  title: 'Malik Tasty Nashta Point - POS & Hotel Management',
  description: 'Keyboard-first Pakistani breakfast billing, Vendor Khata, and Thermal Printing.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"
          integrity="sha512-DTOQO9RWCH3ppGqcWaEA1BIZOC6xxalwEsw9c2QQeAIftl+Vegovlnee1c9QX4TctnWMn13TZye+giMm8e2LwA=="
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
        />
      </head>
      <body className="bg-[#F4F6FB] text-slate-900 min-h-screen flex flex-col antialiased selection:bg-indigo-600 selection:text-white">
        <AuthProvider>
          <SettingsProvider>
            <POSProvider>
              <div id="app-root" className="flex flex-col min-h-screen">
                <AppLayout>{children}</AppLayout>

                {/* Global Modals */}
                <RegisterModal />
                <HeldOrdersModal />
                <DiscountModal />
                <PaymentModal />
              </div>

              {/* Isolated Thermal Print Portal - Rendered outside app-root for 0-spill printing */}
              <div id="thermal-print-portal" aria-hidden="true">
                <ThermalReceiptContainer />
              </div>
            </POSProvider>
          </SettingsProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
