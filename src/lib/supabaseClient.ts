/// <reference types="vite/client" />

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://xzqpcfjzhwsrseuzdqkm.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6cXBjZmp6aHdzcnNldXpkcWttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExOTIwNjgsImV4cCI6MjA5Njc2ODA2OH0.j8YFpNee4cDpesiGPYpJ96o2xSlHe-FkcoeFiLvTKYI';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase URL or Anon Key is missing. Please ensure environment variables are configured.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  }
});
