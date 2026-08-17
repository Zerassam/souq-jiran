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
});
