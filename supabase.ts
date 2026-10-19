import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://tu-proyecto.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'tu-anon-key';

export const isSupabaseConfigured = 
  Boolean(import.meta.env.VITE_SUPABASE_URL) && 
  Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY) && 
  !supabaseUrl.includes('tu-proyecto');

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  }
});

// Cliente auxiliar para crear usuarios (admins o cajeros)
// sin sobrescribir la sesión actual del Superadmin o Dueño
export const createAdminHelperClient = () => {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    }
  });
};

/**
 * Convierte un nombre de usuario y código de comercio en un identificador único seguro.
 * Para superadmin (sin código de comercio): superadmin@devtech.internal
 * Para usuarios de comercio: {username}_{businessCode}@devtech.internal
 */
export const buildVirtualEmail = (username: string, businessCode?: string | null): string => {
  const cleanUser = username.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  if (!businessCode || businessCode.trim() === '' || cleanUser === 'superadmin') {
    return `${cleanUser}@devtech.internal`;
  }
  const cleanCode = businessCode.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  return `${cleanUser}_${cleanCode}@devtech.internal`;
};
