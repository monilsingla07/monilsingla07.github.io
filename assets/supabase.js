// assets/supabase.js
//
// Supabase client, self-hosted (UX-026) so the site no longer depends on
// esm.sh being reachable. assets/vendor/supabase.min.js is an esbuild bundle
// of @supabase/supabase-js@2.112.4 (ESM, minified) exporting createClient.
//
// Re-vendor with:  npm i @supabase/supabase-js@<ver> esbuild
//   echo 'export { createClient } from "@supabase/supabase-js";' > entry.js
//   npx esbuild entry.js --bundle --minify --format=esm --platform=browser //     --target=es2020 --outfile=assets/vendor/supabase.min.js
//
// Note: this is NOT the 2.49.1 used by the Edge Functions; 2.112.4 is what
// production has run on. If the "exclusive LockManager Web Lock ... timed
// out" page-load symptom ever returns, suspect the version first.
import { createClient } from "./vendor/supabase.min.js";
export const SUPABASE_URL = "https://mgmgkwoxirvzdnmayhwq.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_mS_exnQ_Am8_GWMNgCb63w_PfvFA7Mz";

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
