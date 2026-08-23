const baseUrl = process.env.SUPABASE_URL;
const apiKey = process.env.SUPABASE_KEY;

if (!baseUrl || !apiKey) {
  throw new Error("SUPABASE_URL or SUPABASE_KEY is unavailable");
}

const headers = {
  apikey: apiKey,
  Authorization: `Bearer ${apiKey}`,
};

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers ?? {}) },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${options.method ?? "GET"} ${path} failed (${response.status}): ${body}`);
  }
  return response;
}

async function countTable(table) {
  const response = await request(`/rest/v1/${table}?select=id&limit=1`, {
    headers: { Prefer: "count=exact" },
  });
  const count = response.headers.get("content-range")?.split("/").at(-1);
  return Number(count ?? 0);
}

const publicTables = [
  "profiles",
  "merchants",
  "couriers",
  "merchant_courier_approvals",
  "products",
  "orders",
  "order_items",
  "order_messages",
  "order_user_archives",
  "message_user_archives",
  "admin_archive_audit_logs",
  "admin_archive_notifications",
  "admin_order_notifications",
  "test_account_review_audit_logs",
];

const [profileResponse, authUsersResponse, ...tableCounts] = await Promise.all([
  request("/rest/v1/profiles?select=id,email,role&role=eq.admin"),
  request("/auth/v1/admin/users?per_page=1000"),
  ...publicTables.map(async table => ({ table, count: await countTable(table) })),
]);

const admins = await profileResponse.json();
const authPayload = await authUsersResponse.json();
const authUsers = Array.isArray(authPayload.users) ? authPayload.users : [];

const summary = {
  adminProfiles: admins.map(({ id, email, role }) => ({ id, email, role })),
  authUserCount: authUsers.length,
  authAdminCount: authUsers.filter(user => admins.some(admin => admin.id === user.id)).length,
  publicTableCounts: Object.fromEntries(tableCounts.map(({ table, count }) => [table, count])),
};

console.log(JSON.stringify(summary, null, 2));
