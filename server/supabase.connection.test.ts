import { describe, expect, it } from "vitest";

const suppliedProjectUrl = "https://ojmitpxuhgyjuxlbbikf.supabase.co";
const suppliedPublishableKey = "sb_publishable_MzeAhcOpwKo78cbHyHy7XA_ehyAAL2i";
const projectUrl = process.env.VITE_SUPABASE_URL?.startsWith("https://")
  ? process.env.VITE_SUPABASE_URL
  : suppliedProjectUrl;
const publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.startsWith("sb_publishable_")
  ? process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  : suppliedPublishableKey;

describe("Supabase configuration", () => {
  it("accepts the configured publishable key for the Auth settings endpoint", async () => {
    expect(projectUrl).toMatch(/^https:\/\/[a-z0-9-]+\.supabase\.co$/i);
    expect(publishableKey).toMatch(/^sb_publishable_/);

    const response = await fetch(`${projectUrl}/auth/v1/settings`, {
      headers: {
        apikey: publishableKey!,
      },
    });

    expect(response.ok).toBe(true);
  });

  it("advertises Email OTP as enabled without starting a user session", async () => {
    const response = await fetch(`${projectUrl}/auth/v1/settings`, {
      headers: {
        apikey: publishableKey!,
      },
    });

    expect(response.ok).toBe(true);
    const settings = await response.json();
    expect(settings.external).toMatchObject({ email: true });
  });

  it("exposes the public catalogue while RLS hides account and order data", async () => {
    for (const table of ["merchants", "products"]) {
      const response = await fetch(`${projectUrl}/rest/v1/${table}?select=*&limit=1`, {
        headers: {
          apikey: publishableKey!,
          Authorization: `Bearer ${publishableKey!}`,
        },
      });

      expect(response.ok, `${table} should exist and accept the RLS-protected request`).toBe(true);
      expect(Array.isArray(await response.json()), `${table} should expose an array to anonymous browsing`).toBe(true);
    }

    for (const table of [
      "profiles",
      "couriers",
      "merchant_courier_approvals",
      "orders",
      "order_items",
      "order_user_archives",
      "order_messages",
      "message_user_archives",
    ]) {
      const response = await fetch(`${projectUrl}/rest/v1/${table}?select=*&limit=1`, {
        headers: {
          apikey: publishableKey!,
          Authorization: `Bearer ${publishableKey!}`,
        },
      });

      expect(response.ok, `${table} should exist and accept the RLS-protected request`).toBe(true);
      expect(await response.json()).toEqual([]);
    }
  }, 15_000);

  it("treats anonymous callers as unassigned", async () => {
    const roleResponse = await fetch(`${projectUrl}/rest/v1/rpc/current_app_role`, {
      method: "POST",
      headers: {
        apikey: publishableKey!,
        Authorization: `Bearer ${publishableKey!}`,
        "Content-Type": "application/json",
      },
      body: "{}",
    });

    expect(roleResponse.ok).toBe(true);
    expect(await roleResponse.json()).toBe("");

  }, 15_000);

  it("rejects anonymous order creation before it can change production data", async () => {
    const anonymousHeaders = {
      apikey: publishableKey!,
      Authorization: `Bearer ${publishableKey!}`,
      "Content-Type": "application/json",
    };
    const nonExistentId = "00000000-0000-0000-0000-000000000000";
    const protectedCalls = [{
      name: "create_customer_order",
      body: { p_merchant_id: nonExistentId, p_items: [], p_delivery_choice: "pickup" },
    }];

    for (const rpc of protectedCalls) {
      const response = await fetch(`${projectUrl}/rest/v1/rpc/${rpc.name}`, {
        method: "POST",
        headers: anonymousHeaders,
        body: JSON.stringify(rpc.body),
      });
      expect(response.ok, `${rpc.name} must reject anonymous execution`).toBe(false);
      expect(JSON.stringify(await response.json())).not.toContain("00000000-0000-0000-0000-000000000000");
    }
  }, 15_000);
});
