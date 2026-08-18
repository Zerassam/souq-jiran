const baseUrl = process.env.VITE_SUPABASE_URL;
const apiKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const email = process.env.SOUQ_COURIER_EMAIL;
const password = process.env.SOUQ_COURIER_PASSWORD;

if (![baseUrl, apiKey, email, password].every(Boolean)) {
  throw new Error("Missing required Supabase or courier showcase environment variables");
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

async function main() {
  const session = await request("/auth/v1/token?grant_type=password", {
    method: "POST",
    body: { email, password },
  });
  const courierId = session.user?.id;
  if (!session.access_token || !courierId) throw new Error("Courier login did not return an active session");

  const [courier] = await request(`/rest/v1/couriers?id=eq.${courierId}&select=status,wilaya,communes,availability`, { token: session.access_token });
  const orders = await request(`/rest/v1/orders?courier_id=eq.${courierId}&select=status,delivery_choice,delivery_fee,created_at&order=created_at.desc&limit=1`, { token: session.access_token });
  const assignedOrder = orders[0] || null;

  if (courier?.status !== "approved") throw new Error("Courier showcase account is not approved");
  if (!assignedOrder || assignedOrder.delivery_choice !== "courier" || assignedOrder.status !== "assigned") {
    throw new Error("No assigned courier-delivery order is visible to the showcase courier");
  }

  console.log(JSON.stringify({
    courierApproved: true,
    coverage: { wilaya: courier.wilaya, communes: courier.communes, availability: courier.availability },
    assignedOrder: { status: assignedOrder.status, deliveryChoice: assignedOrder.delivery_choice, deliveryFee: assignedOrder.delivery_fee },
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
