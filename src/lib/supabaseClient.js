import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Supabase only takes over when explicitly enabled AND configured.
// This lets us ship the data layer without changing default (localStorage) behavior.
export const SUPABASE_ENABLED =
  import.meta.env.VITE_USE_SUPABASE === 'true' && Boolean(url) && Boolean(anonKey);

export const ORG_ID = import.meta.env.VITE_ORG_ID || 'medici';

export const supabase = SUPABASE_ENABLED ? createClient(url, anonKey) : null;
