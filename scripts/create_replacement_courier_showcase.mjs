const required = [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SHOWCASE_COURIER_EMAIL",
  "SHOWCASE_COURIER_PASSWORD",
  "SOUQ_ADMIN_EMAIL",
  "SOUQ_ADMIN_PASSWORD",
];

for (const key of required) {
  if (!process.env[key]) throw new Error(`Missing required environment variable: ${key}`);
}

const baseUrl = process.env.SUPABASE_URL.replace(/\/$/, "");
const anonKey = process.env.SUPABASE_ANON_KEY;
const courierEmail = process.env.SHOWCASE_COURIER_EMAIL.trim().toLowerCase();
const courierPassword = process.env.SHOWCASE_COURIER_PASSWORD;

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
      email: courierEmail,
      password: courierPassword,
      data: {
        role: "courier",
        name: "موصل العرض البديل — البليدة",
        phone: "0550123502",
      },
    }),
  });
} catch (error) {
  // A duplicate response may be deliberately generic. Password login below is
  // the only account-existence check and prevents any account enumeration.
  if (!String(error.message).includes("already") && !String(error.message).includes("(422)")) throw error;
}

const courierSession = signup?.access_token ? signup : await signIn(courierEmail, courierPassword);
const courierId = courierSession.user?.id;
if (!courierId) throw new Error("Could not resolve the replacement courier identifier.");

const existingCourier = await request(`/rest/v1/couriers?select=id,status,wilaya,communes&id=eq.${courierId}`, {
  headers: { Authorization: `Bearer ${courierSession.access_token}` },
});

if (!existingCourier?.length) {
  await request("/rest/v1/couriers", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${courierSession.access_token}`,
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      id: courierId,
      vehicle: "دراجة نارية",
      wilaya: "البليدة",
      communes: ["البليدة"],
      availability: ["morning"],
      store_mode: "all",
      selected_store_ids: [],
      status: "pending",
    }),
  });
}

const adminSession = await signIn(process.env.SOUQ_ADMIN_EMAIL, process.env.SOUQ_ADMIN_PASSWORD);
await request("/rest/v1/rpc/admin_set_provider_status", {
  method: "POST",
  headers: { Authorization: `Bearer ${adminSession.access_token}` },
  body: JSON.stringify({
    p_provider_type: "courier",
    p_provider_id: courierId,
    p_status: "approved",
  }),
});

const verifiedSession = await signIn(courierEmail, courierPassword);
const courierProfile = await request(`/rest/v1/couriers?select=id,status,wilaya,communes,availability&id=eq.${courierId}`, {
  headers: { Authorization: `Bearer ${verifiedSession.access_token}` },
});
const courier = courierProfile?.[0];
if (!courier || courier.status !== "approved") {
  throw new Error("Replacement courier was not approved or is not visible to its owner.");
}

console.log(JSON.stringify({
  success: true,
  courierId,
  email: courierEmail,
  status: courier.status,
  wilaya: courier.wilaya,
  communes: courier.communes,
  loginVerified: Boolean(verifiedSession.access_token),
}));
