import { describe, expect, it } from "vitest";

describe("Google Maps JavaScript API key", () => {
  it("loads the Maps JavaScript bootstrap without a key-validation error", async () => {
    const apiKey = process.env.VITE_GOOGLE_MAPS_API_KEY;
    expect(apiKey, "VITE_GOOGLE_MAPS_API_KEY must be configured").toBeTruthy();

    const url = new URL("https://maps.googleapis.com/maps/api/js");
    url.searchParams.set("key", apiKey!);
    url.searchParams.set("v", "weekly");

    const response = await fetch(url, { signal: AbortSignal.timeout(12_000) });
    const script = await response.text();

    expect(response.ok).toBe(true);
    expect(script).not.toContain("InvalidKeyMapError");
    expect(script).not.toContain("ApiNotActivatedMapError");
    expect(script).not.toContain("RefererNotAllowedMapError");
  }, 15_000);
});
