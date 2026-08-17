import { createClient } from "@supabase/supabase-js";

const fallbackUrl = "https://ojmitpxuhgyjuxlbbikf.supabase.co";
const fallbackPublishableKey = "sb_publishable_MzeAhcOpwKo78cbHyHy7XA_ehyAAL2i";
const configuredUrl = String(import.meta.env.VITE_SUPABASE_URL || "").trim();
const configuredPublishableKey = String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "").trim();

// VITE_* values are the primary configuration. The fallback only prevents the
// published client from crashing if the hosting environment omits these public values.
const supabaseUrl = /^https:\/\/.+\.supabase\.co\/?$/i.test(configuredUrl) ? configuredUrl : fallbackUrl;
const supabasePublishableKey = configuredPublishableKey.startsWith("sb_publishable_")
  ? configuredPublishableKey
  : fallbackPublishableKey;

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
