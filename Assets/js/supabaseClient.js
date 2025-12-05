// Carga robusta para evitar bloquear la app si el CDN falla
export const SUPABASE_URL = 'https://mzujvobgqpzpvhharsse.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16dWp2b2JncXB6cHZoaGFyc3NlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwMDA5ODcsImV4cCI6MjA3ODU3Njk4N30.Ckh2SaA5eTRtakHx8uwXNBZl3dwxtwjQl9SbtDQTbho';

let supabase = null;

try {
    import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm')
        .then((mod) => {
            const createClient = mod && mod.createClient ? mod.createClient : null;
            if (createClient && SUPABASE_URL && SUPABASE_ANON_KEY) {
                supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            }
        })
        .catch(() => {});
} catch (e) {}

export default supabase;
