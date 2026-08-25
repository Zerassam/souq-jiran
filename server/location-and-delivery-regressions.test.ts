import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const appSource = readFileSync(resolve(process.cwd(), "client/src/pages/SouqJiranApp.jsx"), "utf8");
const migrationSource = readFileSync(resolve(process.cwd(), "supabase/migrations/20260906_profile_location_blacklist_guard.sql"), "utf8");

describe("location and delivery regression guards", () => {
  it("keeps a real GPS picker for merchant and courier registration", () => {
    expect(appSource).toContain("تحديد موقع المحل بدقة عبر GPS");
    expect(appSource).toContain("تحديد الموقع عبر GPS");
    expect(appSource).toContain("latitude: Number(position.latitude)");
    expect(appSource).toContain("longitude: Number(position.longitude)");
  });

  it("persists location and delivery ownership for every provider role", () => {
    expect(appSource).toContain("has_own_delivery: Boolean(form.hasOwnDelivery)");
    expect(appSource).toContain("role: \"courier\", name: form.name, phone, wilaya: form.wilaya");
    expect(appSource).toContain("address_label: form.addressLabel || null");
    expect(appSource).toContain("latitude: Number.isFinite(form.latitude) ? form.latitude : null");
    expect(appSource).toContain("longitude: Number.isFinite(form.longitude) ? form.longitude : null");
  });

  it("defines the production blacklist RPC with authenticated-only execution", () => {
    expect(migrationSource).toContain("create or replace function public.is_customer_blacklisted(p_customer_id uuid)");
    expect(migrationSource).toContain("revoke all on function public.is_customer_blacklisted(uuid) from public;");
    expect(migrationSource).toContain("grant execute on function public.is_customer_blacklisted(uuid) to authenticated;");
  });
});
