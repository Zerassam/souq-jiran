const baseUrl = process.env.VITE_SUPABASE_URL;
const apiKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const merchantEmail = process.env.SOUQ_MERCHANT_EMAIL;
const merchantOldPassword = process.env.SOUQ_MERCHANT_OLD_PASSWORD;
const merchantNewPassword = process.env.SOUQ_MERCHANT_NEW_PASSWORD;
const courierEmail = process.env.SOUQ_COURIER_EMAIL;
const courierOldPassword = process.env.SOUQ_COURIER_OLD_PASSWORD;
const courierNewPassword = process.env.SOUQ_COURIER_NEW_PASSWORD;

if (![baseUrl, apiKey, merchantEmail, merchantOldPassword, merchantNewPassword, courierEmail, courierOldPassword, courierNewPassword].every(Boolean)) {
  throw new Error("Missing required Supabase or showcase-account environment variables");
}

async function request(path, { method = "GET", token, body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      apikey: apiKey,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${method} ${path} failed (${response.status}): ${text}`);
  return text ? JSON.parse(text) : null;
}

async function signIn(email, password) {
  const payload = await request("/auth/v1/token?grant_type=password", { method: "POST", body: { email, password } });
  if (!payload.access_token) throw new Error(`Login did not return an active session for ${email}`);
  return payload.access_token;
}

async function rotate(label, email, oldPassword, newPassword) {
  const token = await signIn(email, oldPassword);
  await request("/auth/v1/user", { method: "PUT", token, body: { password: newPassword } });
  await signIn(email, newPassword);
  return { label, email, loginVerified: true };
}

async function main() {
  const results = await Promise.all([
    rotate("merchant", merchantEmail, merchantOldPassword, merchantNewPassword),
    rotate("courier", courierEmail, courierOldPassword, courierNewPassword),
  ]);
  console.log(JSON.stringify(results, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
