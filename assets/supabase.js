// assets/supabase.js
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const SUPABASE_URL = "https://mgmgkwoxirvzdnmayhwq.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_mS_exnQ_Am8_GWMNgCb63w_PfvFA7Mz";


export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});
