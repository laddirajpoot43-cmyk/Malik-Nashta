'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { PosSettings } from '@/types/pos';

interface SettingsContextType {
  settings: PosSettings;
  loading: boolean;
  updateSettings: (updates: Partial<PosSettings>) => Promise<{ success: boolean; error?: string }>;
  refreshSettings: () => Promise<void>;
}

const defaultSettings: PosSettings = {
  id: '33333333-3333-3333-3333-333333333301',
  business_name: 'MALIK TASTY NASHTA POINT',
  address: 'Vehari Road, Hasilpur, Punjab, Pakistan',
  phone: '0300-1234567',
  greeting_message: 'Fresh & Crispy Nashta Everyday',
  admin_pin: '1234',
  cash_rounding_enabled: true,
  require_admin_pin_refunds: true,
  default_tax_rate: 0,
  max_cashier_discount_percent: 15,
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<PosSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);

  const refreshSettings = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (data.success && data.settings) {
        setSettings(data.settings);
      }
    } catch (e) {
      console.error('Failed to load settings', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshSettings();
  }, []);

  const updateSettings = async (updates: Partial<PosSettings>): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (data.success && data.settings) {
        setSettings(data.settings);
        return { success: true };
      }
      return { success: false, error: data.error || 'Failed to update settings' };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  };

  return (
    <SettingsContext.Provider value={{ settings, loading, updateSettings, refreshSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used within a SettingsProvider');
  return context;
}

