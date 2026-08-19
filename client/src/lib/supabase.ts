import { createClient } from "@supabase/supabase-js";
import { getFirebaseIdToken } from "./firebase";

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

const supabaseAuthOptions = {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
};

// The application continues to use the existing Supabase session client while
// phone users are migrated. This preserves legacy email/password accounts and
// the UUID foreign keys already present in the operational tables.
export const supabase = createClient(supabaseUrl, supabasePublishableKey, supabaseAuthOptions);

// Use this client only for requests that are explicitly compatible with
// Supabase Third-party Auth. Its Authorization header is a Firebase ID token.
// The Supabase dashboard must first register `souq-jiran` as a Third-party
// Auth integration and Firebase users must carry role=authenticated.
export const firebaseSupabase = createClient(supabaseUrl, supabasePublishableKey, {
  ...supabaseAuthOptions,
  // Firebase Phone Authentication is the trusted source for phone ownership.
  accessToken: async () => getFirebaseIdToken(false),
});
