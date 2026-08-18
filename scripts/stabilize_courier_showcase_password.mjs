const baseUrl = process.env.VITE_SUPABASE_URL;
const apiKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const email = process.env.SOUQ_COURIER_EMAIL;
const currentPassword = process.env.SOUQ_COURIER_CURRENT_PASSWORD;
const finalPassword = process.env.SOUQ_COURIER_FINAL_PASSWORD;

if (![baseUrl, apiKey, email, currentPassword, finalPassword].every(Boolean)) {
  throw new Error("Missing required Supabase or courier password variables");
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

async function signIn(password) {
  const session = await request("/auth/v1/token?grant_type=password", {
    method: "POST",
    body: { email, password },
  });
  if (!session.access_token) throw new Error("Courier login did not return an active session");
  return session.access_token;
}

async function main() {
  const token = await signIn(currentPassword);
  await request("/auth/v1/user", { method: "PUT", token, body: { password: finalPassword } });
  await signIn(finalPassword);
  console.log(JSON.stringify({ email, loginVerified: true }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
