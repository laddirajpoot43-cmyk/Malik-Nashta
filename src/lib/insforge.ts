import { createClient, createAdminClient } from '@insforge/sdk';

export const INSFORGE_BASE_URL = process.env.NEXT_PUBLIC_INSFORGE_URL || 'https://nhg6znia.us-east.insforge.app';
export const INSFORGE_API_KEY = process.env.INSFORGE_API_KEY || process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY || 'ik_8cc83feaef3681d6c141ed1613c2f8e1';

export const insforge = createClient({
  baseUrl: INSFORGE_BASE_URL,
  anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY || INSFORGE_API_KEY,
});

export const insforgeAdmin = createAdminClient({
  baseUrl: INSFORGE_BASE_URL,
  apiKey: INSFORGE_API_KEY,
});



