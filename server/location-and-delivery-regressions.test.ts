import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const appSource = readFileSync(resolve(process.cwd(), "client/src/pages/SouqJiranApp.jsx"), "utf8");
const migrationSource = readFileSync(resolve(process.cwd(), "supabase/migrations/20260906_profile_location_blacklist_guard.sql"), "utf8");
const merchantLocationRepairSource = readFileSync(resolve(process.cwd(), "supabase/migrations/20260907_merchant_location_columns_repair.sql"), "utf8");

describe("location and delivery regression guards", () => {
  it("keeps a real GPS picker for merchant and courier registration", () => {
    expect(appSource).toContain("تحديد موقع المحل بدقة عبر GPS");
    expect(appSource).toContain("تحديد الموقع عبر GPS");
    expect(appSource).toContain("latitude: Number(position.latitude)");
    expect(appSource).toContain("longitude: Number(position.longitude)");
  });

  it("lets merchants select and persist an exact map location from settings", () => {
    expect(appSource).toContain('data-testid="merchant-location-map"');
    expect(appSource).toContain('data-testid="confirm-location"');
    expect(appSource).toContain('onMapClick={handleMapClick}');
    expect(appSource).toContain('initialCenter={{ lat, lng }}');
    expect(appSource).toContain('title: "موقع المحل"');
    expect(appSource).toContain('latitude={myStore.latitude ?? myStore.lat}');
    expect(appSource).toContain('longitude={myStore.longitude ?? myStore.lng}');
    expect(appSource).toContain('updateStoreLocation({ latitude: pos.latitude, longitude: pos.longitude })');
    expect(appSource).toContain('supabase.rpc("merchant_update_location"');
    const locationMigration = readFileSync(resolve(process.cwd(), "supabase/migrations/20260826_merchant_location_update.sql"), "utf8");
    expect(locationMigration).toContain("create or replace function public.merchant_update_location");
    expect(locationMigration).toContain("where id = auth.uid()");
    expect(locationMigration).toContain("revoke execute on function public.merchant_update_location(numeric, numeric) from public, anon");
    expect(locationMigration).toContain("grant execute on function public.merchant_update_location(numeric, numeric) to authenticated");
    expect(locationMigration).toContain("notify pgrst, 'reload schema'");
    expect(locationMigration).toContain("add column if not exists latitude");
    expect(locationMigration).toContain("add column if not exists longitude");
    expect(merchantLocationRepairSource).toContain("alter table public.merchants");
    expect(merchantLocationRepairSource).toContain("add column if not exists latitude");
    expect(merchantLocationRepairSource).toContain("add column if not exists longitude");
    expect(merchantLocationRepairSource).toContain("create or replace function public.merchant_update_location");
    expect(merchantLocationRepairSource).toContain("notify pgrst, 'reload schema'");
    expect(appSource).toContain("أعمدة الإحداثيات غير مفعّلة في Supabase");
    expect(appSource).toContain("updateStore(previousLocation)");
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

it("does not make a delivery window mandatory for immediate delivery", () => {
  expect(appSource).toContain('deliverySchedule?.mode || "none"');
  expect(appSource).toContain('deliveryType !== "pickup" && scheduleMode !== "none"');
  expect(appSource).toContain("تابع بالتوصيل الفوري");
});

it("keeps the SQL migration for optional scheduling reviewable", () => {
  const optionalMigration = readFileSync(resolve(process.cwd(), "supabase/migrations/20260906_optional_delivery_schedule.sql"), "utf8");
  expect(optionalMigration).toContain("p_delivery_schedule_mode text default 'none'");
  expect(optionalMigration).toContain("DELIVERY_WINDOW_MUST_BE_90_MINUTES");
  expect(optionalMigration).toContain("v_schedule_status text := 'not_requested'");
});
