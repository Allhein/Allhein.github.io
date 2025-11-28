import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// TODO: Reemplaza los valores con las credenciales reales de tu proyecto Supabase.
export const SUPABASE_URL = 'https://mzujvobgqpzpvhharsse.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16dWp2b2JncXB6cHZoaGFyc3NlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwMDA5ODcsImV4cCI6MjA3ODU3Njk4N30.Ckh2SaA5eTRtakHx8uwXNBZl3dwxtwjQl9SbtDQTbho';

let supabase = null;

if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} else {
    console.warn('Supabase no está configurado. Actualiza Assets/js/supabaseClient.js con tus credenciales públicas.');
}

export default supabase;
