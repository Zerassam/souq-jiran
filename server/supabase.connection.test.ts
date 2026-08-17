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

  it("exposes the migrated tables through REST while RLS returns no unauthorised rows", async () => {
    for (const table of ["profiles", "merchants", "couriers", "merchant_courier_approvals", "orders"]) {
      const response = await fetch(`${projectUrl}/rest/v1/${table}?select=*&limit=1`, {
        headers: {
          apikey: publishableKey!,
          Authorization: `Bearer ${publishableKey!}`,
        },
      });

      expect(response.ok, `${table} should exist and accept the RLS-protected request`).toBe(true);
      expect(await response.json()).toEqual([]);
    }
  });
});
