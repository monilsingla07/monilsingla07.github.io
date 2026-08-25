// assets/supabase.js
//
// ⚠️  KEEP THIS VERSION PINNED.
// @supabase/supabase-js@2.97+ introduced a breaking change in auth-js that uses
// an exclusive LockManager Web Lock during initialisation. With autoRefreshToken
// enabled, this causes a 10-second timeout on page load in some tab/network
// conditions ("Acquiring an exclusive Navigator LockManager lock … timed out").
// Pin to 2.49.1 — the same version used in all Edge Functions — which is stable.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export const SUPABASE_URL = "https://mgmgkwoxirvzdnmayhwq.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1nbWdrd294aXJ2emRubWF5aHdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1MjcwNzEsImV4cCI6MjA4NTEwMzA3MX0.tBJzNSNBBrZ1TtELBkS3ZOhEsHZCrcEYJcGv-BkdHVY";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // Explicit storage key keeps the lock name stable and avoids collisions
    // if a second createClient call is ever made elsewhere on the page.
    storageKey: "ahamstree-auth",
  },
});
