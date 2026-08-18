const baseUrl = process.env.VITE_SUPABASE_URL;
const apiKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const adminEmail = process.env.SOUQ_ADMIN_EMAIL;
const adminPassword = process.env.SOUQ_ADMIN_PASSWORD;
const courierEmail = process.env.SOUQ_COURIER_EMAIL;
const courierPassword = process.env.SOUQ_COURIER_PASSWORD;

if (![baseUrl, apiKey, adminEmail, adminPassword, courierEmail, courierPassword].every(Boolean)) {
  throw new Error("Missing required Supabase or test-account environment variables");
}

const nonce = Date.now().toString(36);
const merchantEmail = `delivery-flow-merchant-${nonce}@example.com`;
const customerEmail = `delivery-flow-customer-${nonce}@example.com`;
const merchantPassword = `MerchantFlow-${nonce}-A!`;
const customerPassword = `CustomerFlow-${nonce}-A!`;

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function request(path, { method = "GET", token, body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      apikey: apiKey,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(method === "POST" ? { Prefer: "return=representation" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(`${method} ${path} failed (${response.status}): ${text}`);
  return payload;
}

async function signUp(email, password, role, name) {
  const payload = await request("/auth/v1/signup", {
    method: "POST",
    body: { email, password, data: { role, name } },
  });
  if (!payload.access_token || !payload.user?.id) throw new Error(`Signup did not return an active session for ${email}`);
  return { id: payload.user.id, token: payload.access_token };
}

async function signIn(email, password) {
  const payload = await request("/auth/v1/token?grant_type=password", {
    method: "POST",
    body: { email, password },
  });
  if (!payload.access_token || !payload.user?.id) throw new Error(`Login did not return an active session for ${email}`);
  return { id: payload.user.id, token: payload.access_token };
}

async function main() {
  const merchant = await signUp(merchantEmail, merchantPassword, "merchant", "متجر اختبار مسار التوصيل");
  const customer = await signUp(customerEmail, customerPassword, "customer", "عميل اختبار مسار التوصيل");
  const admin = await signIn(adminEmail, adminPassword);
  const courier = await signIn(courierEmail, courierPassword);

  // The authentication trigger creates profiles asynchronously on some Supabase plans.
  await sleep(500);

  const merchantProfile = {
    id: merchant.id,
    store_name: "متجر اختبار مسار التوصيل",
    wilaya: "البليدة",
    commune: "البليدة",
    phone: "0550000000",
    delivery_communes: ["البليدة"],
    status: "pending_review",
  };
  await request("/rest/v1/merchants", { method: "POST", token: merchant.token, body: merchantProfile });
  await request("/rest/v1/rpc/admin_set_provider_status", {
    method: "POST",
    token: admin.token,
    body: { p_provider_type: "merchant", p_provider_id: merchant.id, p_status: "approved" },
  });

  const [product] = await request("/rest/v1/products", {
    method: "POST",
    token: merchant.token,
    body: { merchant_id: merchant.id, name: "منتج اختبار التوصيل", price: 120, unit: "قطعة", department: "test", available: true },
  });

  const order = await request("/rest/v1/rpc/create_customer_order", {
    method: "POST",
    token: customer.token,
    body: {
      p_merchant_id: merchant.id,
      p_items: [{ product_id: product.id, qty: 1 }],
      p_delivery_choice: "courier",
      p_delivery_address: { label: "عنوان اختبار — البليدة" },
      p_delivery_fee: 150,
    },
  });

  await request("/rest/v1/rpc/set_merchant_order_status", { method: "POST", token: merchant.token, body: { p_order_id: order.id, p_status: "accepted" } });
  await request("/rest/v1/rpc/set_merchant_order_status", { method: "POST", token: merchant.token, body: { p_order_id: order.id, p_status: "preparing" } });
  await request("/rest/v1/rpc/set_merchant_order_status", { method: "POST", token: merchant.token, body: { p_order_id: order.id, p_status: "ready" } });
  const assigned = await request("/rest/v1/rpc/claim_ready_order", { method: "POST", token: courier.token, body: { p_order_id: order.id } });

  console.log(JSON.stringify({
    merchantEmail,
    customerEmail,
    orderId: assigned.id,
    orderStatus: assigned.status,
    courierId: assigned.courier_id,
    note: "The order remains assigned so the courier dashboard can be visually inspected.",
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
