const required = [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SHOWCASE_MERCHANT_EMAIL",
  "SHOWCASE_MERCHANT_PASSWORD",
  "SOUQ_ADMIN_EMAIL",
  "SOUQ_ADMIN_PASSWORD",
];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

const baseUrl = process.env.SUPABASE_URL.replace(/\/$/, "");
const anonKey = process.env.SUPABASE_ANON_KEY;
const merchantEmail = process.env.SHOWCASE_MERCHANT_EMAIL.trim().toLowerCase();
const merchantPassword = process.env.SHOWCASE_MERCHANT_PASSWORD;

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      apikey: anonKey,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`${path} failed (${response.status}): ${body?.message ?? body?.error ?? "unknown error"}`);
  }
  return body;
}

async function signIn(email, password) {
  return request("/auth/v1/token?grant_type=password", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

let signup;
try {
  signup = await request("/auth/v1/signup", {
    method: "POST",
    body: JSON.stringify({
      email: merchantEmail,
      password: merchantPassword,
      data: {
        role: "merchant",
        name: "تاجر العرض البديل",
        phone: "0550123501",
      },
    }),
  });
} catch (error) {
  // Supabase may return either a descriptive duplicate-account message or a
  // generic 422 response when email enumeration protection is enabled. The
  // subsequent password login remains the definitive, non-enumerating check.
  if (!String(error.message).includes("already") && !String(error.message).includes("(422)")) throw error;
}

const merchantSession = signup?.access_token ? signup : await signIn(merchantEmail, merchantPassword);
const merchantId = merchantSession.user?.id;
if (!merchantId) throw new Error("Could not resolve the replacement merchant identifier.");

const existingMerchant = await request(`/rest/v1/merchants?select=id,status&id=eq.${merchantId}`, {
  headers: { Authorization: `Bearer ${merchantSession.access_token}` },
});

if (!existingMerchant?.length) {
  await request("/rest/v1/merchants", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${merchantSession.access_token}`,
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      id: merchantId,
      store_name: "متجر العرض البديل — البليدة",
      wilaya: "البليدة",
      commune: "البليدة",
      phone: "0550123501",
      delivery_communes: ["البليدة"],
      status: "pending_review",
    }),
  });
}

const adminSession = await signIn(process.env.SOUQ_ADMIN_EMAIL, process.env.SOUQ_ADMIN_PASSWORD);
await request("/rest/v1/rpc/admin_set_provider_status", {
  method: "POST",
  headers: { Authorization: `Bearer ${adminSession.access_token}` },
  body: JSON.stringify({
    p_provider_type: "merchant",
    p_provider_id: merchantId,
    p_status: "approved",
  }),
});

const verifiedSession = await signIn(merchantEmail, merchantPassword);
const merchantProfile = await request(`/rest/v1/merchants?select=id,store_name,status,wilaya,commune&id=eq.${merchantId}`, {
  headers: { Authorization: `Bearer ${verifiedSession.access_token}` },
});
const merchantStore = merchantProfile?.[0];
if (!merchantStore || merchantStore.status !== "approved") {
  throw new Error("Replacement merchant store was not approved or is not visible to its owner.");
}

console.log(JSON.stringify({
  success: true,
  merchantId,
  email: merchantEmail,
  storeName: merchantStore.store_name,
  storeStatus: merchantStore.status,
  loginVerified: Boolean(verifiedSession.access_token),
}));
