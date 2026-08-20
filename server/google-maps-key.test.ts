import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Interactive map integration", () => {
  it("uses an open map layer rather than a browser-exposed Google Maps key or proxy", () => {
    const mapSource = readFileSync(resolve(import.meta.dirname, "../client/src/components/Map.tsx"), "utf8");

    expect(mapSource).toContain('from "leaflet"');
    expect(mapSource).toContain("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png");
    expect(mapSource).toContain("markers?: MapMarker[]");
    expect(mapSource).not.toContain("VITE_GOOGLE_MAPS_API_KEY");
    expect(mapSource).not.toContain("VITE_FRONTEND_FORGE_API_KEY");
    expect(mapSource).not.toContain("https://maps.googleapis.com/maps/api/js?key=");
  });
});
