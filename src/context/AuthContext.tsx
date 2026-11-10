'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Profile } from '@/types/pos';

interface AuthContextType {
  currentUser: Profile | null;
  users: Profile[];
  isAdmin: boolean;
  isAdminMode: boolean;
  enterAdminMode: (pin: string) => Promise<{ success: boolean; error?: string }>;
  exitAdminMode: () => void;
  loginWithPin: (pin: string) => Promise<{ success: boolean; user?: Profile; error?: string }>;
  logout: () => void;
  switchUser: (userId: string) => void;
  verifyAdminPin: (pin: string) => Promise<boolean>;
  refreshUsers: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [users, setUsers] = useState<Profile[]>([]);
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [isAdminMode, setIsAdminMode] = useState<boolean>(false);

  // Check session storage on mount
  useEffect(() => {
    try {
      const savedAdmin = sessionStorage.getItem('malik_pos_admin_mode');
      if (savedAdmin === 'true') {
        setIsAdminMode(true);
      }
    } catch {
      // ignore SSR or storage errors
    }
  }, []);

  const refreshUsers = async () => {
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      if (data.success && Array.isArray(data.users)) {
        setUsers(data.users);
        if (!currentUser && data.users.length > 0) {
          // Default to cashier or first user
          const cashier = data.users.find((u: Profile) => u.role === 'cashier') || data.users[0];
          setCurrentUser(cashier);
        }
      }
    } catch (e) {
      console.error('Failed to load users', e);
    }
  };

  useEffect(() => {
    refreshUsers();
  }, []);

  const verifyAdminPin = async (pin: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      const adminPin = data?.settings?.admin_pin || '1234';
      if (pin.trim() === adminPin.trim()) return true;

      // Also check if matches any admin profile pin
      const adminUser = users.find((u) => u.role === 'admin' && u.pin_code === pin.trim());
      return Boolean(adminUser);
    } catch {
      return pin.trim() === '1234';
    }
  };

  const enterAdminMode = async (pin: string): Promise<{ success: boolean; error?: string }> => {
    const valid = await verifyAdminPin(pin);
    if (valid) {
      setIsAdminMode(true);
      try {
        sessionStorage.setItem('malik_pos_admin_mode', 'true');
      } catch {}
      // Switch active user to an admin profile if currently cashier
      const adminUser = users.find((u) => u.role === 'admin');
      if (adminUser) {
        setCurrentUser(adminUser);
      }
      return { success: true };
    }
    return { success: false, error: 'Incorrect Admin PIN. Access Denied.' };
  };

  const exitAdminMode = () => {
    setIsAdminMode(false);
    try {
      sessionStorage.removeItem('malik_pos_admin_mode');
    } catch {}
    // Switch back to cashier profile
    const cashier = users.find((u) => u.role === 'cashier') || users[0];
    if (cashier) {
      setCurrentUser(cashier);
    }
  };

  const loginWithPin = async (pin: string): Promise<{ success: boolean; user?: Profile; error?: string }> => {
    const matched = users.find((u) => u.pin_code === pin.trim());
    if (matched) {
      setCurrentUser(matched);
      if (matched.role === 'admin') {
        setIsAdminMode(true);
        try {
          sessionStorage.setItem('malik_pos_admin_mode', 'true');
        } catch {}
      } else {
        setIsAdminMode(false);
        try {
          sessionStorage.removeItem('malik_pos_admin_mode');
        } catch {}
      }
      return { success: true, user: matched };
    }
    return { success: false, error: 'Invalid PIN code.' };
  };

  const switchUser = (userId: string) => {
    const found = users.find((u) => u.id === userId);
    if (found) {
      setCurrentUser(found);
      if (found.role === 'admin') {
        setIsAdminMode(true);
        try {
          sessionStorage.setItem('malik_pos_admin_mode', 'true');
        } catch {}
      } else {
        setIsAdminMode(false);
        try {
          sessionStorage.removeItem('malik_pos_admin_mode');
        } catch {}
      }
    }
  };

  const logout = () => {
    exitAdminMode();
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        users,
        isAdmin: currentUser?.role === 'admin' || isAdminMode,
        isAdminMode,
        enterAdminMode,
        exitAdminMode,
        loginWithPin,
        logout,
        switchUser,
        verifyAdminPin,
        refreshUsers,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
