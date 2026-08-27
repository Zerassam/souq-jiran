import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const appSource = readFileSync(resolve(process.cwd(), "client/src/pages/SouqJiranApp.jsx"), "utf8");
const merchantLocationRepairSource = readFileSync(resolve(process.cwd(), "supabase/migrations/20260907_merchant_location_columns_repair.sql"), "utf8");
const merchantBusinessHoursMigration = readFileSync(resolve(process.cwd(), "supabase/migrations/20260908_merchant_business_hours.sql"), "utf8");
const parallelDeliveryMigration = readFileSync(resolve(process.cwd(), "supabase/migrations/20260909_parallel_delivery_and_coverage_zones.sql"), "utf8");
const immediateOrdersMigration = readFileSync(resolve(process.cwd(), "supabase/migrations/20260910_immediate_orders_cart_compatibility.sql"), "utf8");

describe("location and delivery regression guards", () => {
  it("يحفظ ساعات العمل ويعيد تحميلها قبل إظهار وسم الفتح أو الإغلاق", () => {
    expect(appSource).toContain("merchant.opening_hour ?? 8");
    expect(appSource).toContain('supabase.rpc("merchant_update_business_hours"');
    expect(appSource).toContain('data-testid="merchant-business-hours-tab"');
    expect(appSource).toContain("isStoreOpenAtHour(s)");
    expect(merchantBusinessHoursMigration).toContain("add column if not exists opening_hour");
    expect(merchantBusinessHoursMigration).toContain("create or replace function public.merchant_update_business_hours");
    expect(merchantBusinessHoursMigration).toContain("where id = auth.uid()");
    expect(merchantBusinessHoursMigration).toContain("notify pgrst, 'reload schema'");
  });

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

  it("restores the stored merchant coordinates and address with the merchant row", () => {
    expect(appSource).toContain("latitude: merchant.latitude ?? null, longitude: merchant.longitude ?? null, addressLabel: merchant.address_label || \"\"");
    expect(appSource).toContain("updateStore({ lat: latitude, lng: longitude, latitude, longitude })");
    expect(appSource).toContain("supabase.from(\"merchants\").select(\"*\")");
  });

  it("persists location and delivery ownership for every provider role", () => {
    expect(appSource).toContain("has_own_delivery: Boolean(form.hasOwnDelivery)");
    expect(appSource).toContain("role: \"courier\", name: form.name, phone, wilaya: form.wilaya");
    expect(appSource).toContain("address_label: form.addressLabel || null");
    expect(appSource).toContain("latitude: Number.isFinite(form.latitude) ? form.latitude : null");
    expect(appSource).toContain("longitude: Number.isFinite(form.longitude) ? form.longitude : null");
  });

  it("defines the immediate-checkout RPCs with authenticated-only execution", () => {
    expect(immediateOrdersMigration).toContain("create table if not exists public.customer_blacklist");
    expect(immediateOrdersMigration).toContain("alter table public.customer_blacklist enable row level security;");
    expect(immediateOrdersMigration).toContain("create policy customer_blacklist_admin_read on public.customer_blacklist");
    expect(immediateOrdersMigration).toContain("create table if not exists public.delivery_pricing_config");
    expect(immediateOrdersMigration).toContain("insert into public.delivery_pricing_config (id) values (true) on conflict (id) do nothing;");
    expect(immediateOrdersMigration).toContain("alter table public.delivery_pricing_config enable row level security;");
    expect(immediateOrdersMigration).toContain("v_pricing record;");
    expect(immediateOrdersMigration).not.toContain("v_pricing public.delivery_pricing_config;");
    expect(immediateOrdersMigration).toContain("create table if not exists public.order_lifecycle_events");
    expect(immediateOrdersMigration).toContain("create or replace function public.record_order_lifecycle_event(");
    expect(immediateOrdersMigration).toContain("create or replace function public.is_customer_blacklisted(p_customer_id uuid)");
    expect(immediateOrdersMigration).toContain("create or replace function public.quote_delivery(");
    expect(immediateOrdersMigration).toContain("create or replace function public.create_customer_order(");
    expect(immediateOrdersMigration).toContain("revoke all on function public.is_customer_blacklisted(uuid) from public, anon;");
    expect(immediateOrdersMigration).toContain("grant execute on function public.is_customer_blacklisted(uuid) to authenticated;");
    expect(immediateOrdersMigration).toContain("grant execute on function public.quote_delivery(uuid, jsonb, numeric) to authenticated;");
    expect(immediateOrdersMigration).toContain("grant execute on function public.create_customer_order(uuid, jsonb, text, jsonb, integer, text, timestamptz, timestamptz) to authenticated;");
    expect(immediateOrdersMigration).toContain("and not public.merchant_covers_delivery_destination(p_merchant_id, p_delivery_address)");
    expect(immediateOrdersMigration).toContain("'none', 'not_requested', null, null");
    expect(immediateOrdersMigration).toContain("notify pgrst, 'reload schema'");
  });
});

it("removes delivery scheduling from customer checkout and merchant management", () => {
  expect(appSource).not.toContain("DeliverySchedulePicker");
  expect(appSource).not.toContain("MerchantDeliverySchedulePanel");
  expect(appSource).not.toContain("delivery_schedule_options");
  expect(appSource).not.toContain("merchant_respond_delivery_schedule");
  expect(appSource).not.toContain("merchant_save_delivery_schedule");
  expect(appSource).not.toContain("p_delivery_schedule_mode:");
  expect(appSource).not.toContain("p_requested_delivery_window_start:");
  expect(appSource).not.toContain("requestedDeliveryWindowStart:");
  expect(appSource).toContain("async function placeOrder(store, _promo, _discountAmount = 0, address = null, deliveryType = \"pickup\", deliveryFee = 0, rewardCouponCode = null)");
  expect(appSource).toContain("notify(\"تم إرسال طلبك — الدفع نقداً عند الاستلام\")");
});

it("keeps each cart private to an authenticated customer and clears it at logout", () => {
  expect(appSource).toContain("const customerCartStorage = (customerId) => ({ key: `souq-jiran:cart:v5:${customerId}`, shared: false })");
  expect(appSource).toContain("clearKey(STORAGE.legacyCart, emptyCart())");
  expect(appSource).toContain("nextAuth.type === \"customer\"");
  expect(appSource).toContain("await loadKey(customerCartStorage(nextAuth.id), emptyCart())");
  expect(appSource).toContain("if (auth?.type === \"customer\" && auth.id) void saveKey(customerCartStorage(auth.id), next)");
  expect(appSource).toContain("if (cartOwnerId) await clearKey(customerCartStorage(cartOwnerId), emptyCart())");
  expect(appSource).toContain("setCart(emptyCart())");
});

it("uses the exact quote_delivery parameter contract", () => {
  expect(appSource).toContain('supabase.rpc("quote_delivery", { p_merchant_id: merchantId, p_destination: destination, p_weight_kg: weightKg })');
  expect(appSource).not.toContain("p_destination_json");
});

it("uses one safe back policy for Android and visible customer navigation", () => {
  expect(appSource).toContain('App.addListener("backButton"');
  expect(appSource).toContain('const nestedBack = new Event("souq-jiran:back", { cancelable: true })');
  expect(appSource).toContain("window.dispatchEvent(nestedBack)");
  expect(appSource).toContain('window.addEventListener("souq-jiran:back", handleBack)');
  expect(appSource).toContain('if (showCart) { setShowCart(false); event.preventDefault(); return; }');
  expect(appSource).toContain('if (openStoreId) { setOpenStoreId(null); setActiveDept("all"); event.preventDefault(); return; }');
  expect(appSource).toContain('data-testid="app-back-button"');
});

it("keeps store delivery and platform delivery independently selectable", () => {
  expect(appSource).toContain("const platformCourierEnabled = Boolean(cartStore && cartStore.platformDeliveryEnabled !== false)");
  expect(appSource).toContain("const storeDeliveryEnabled = Boolean(cartStore?.hasOwnDelivery || cartStore?.storeDeliveryEnabled)");
  expect(appSource).toContain('const deliveryFee = deliveryChoice === "pickup" ? 0 : Number(deliveryQuote?.fee || 0)');
  expect(appSource).toContain('const needsDeliveryQuote = deliveryChoice !== "pickup"');
  expect(appSource).toContain('storeDeliveryEnabled && { id: "store", label: "توصيل المحل"');
  expect(appSource).toContain('{ id: "courier", label: "موصل معتمد من المنصة"');
  expect(appSource).toContain("يمكن تفعيل توصيل المحل وتوصيل المنصة معاً");
  expect(appSource).toContain('supabase.rpc("merchant_save_delivery_preferences"');
  expect(parallelDeliveryMigration).toContain("case when p_delivery_choice='pickup' then 0 else v_quote.fee end");
  expect(parallelDeliveryMigration).not.toContain("when p_delivery_choice='store' then v_merchant.delivery_fee");
});

it("keeps multi-zone coverage and a non-destructive Supabase migration reviewable", () => {
  expect(appSource).toContain("deliveryCoverageZones.map((zone, index)");
  expect(appSource).toContain("+ إضافة منطقة أخرى");
  expect(parallelDeliveryMigration).toContain("add column if not exists platform_delivery_enabled boolean not null default true");
  expect(parallelDeliveryMigration).toContain("add column if not exists delivery_coverage_zones jsonb not null default '[]'::jsonb");
  expect(parallelDeliveryMigration).toContain("create or replace function public.merchant_save_delivery_preferences");
  expect(parallelDeliveryMigration).toContain("create or replace function public.merchant_covers_delivery_destination");
  expect(parallelDeliveryMigration).toContain("p_delivery_choice = 'store' and not v_merchant.has_own_delivery");
  expect(parallelDeliveryMigration).toContain("p_delivery_choice = 'courier' and not v_merchant.platform_delivery_enabled");
  expect(parallelDeliveryMigration).not.toContain("update public.merchants\nset delivery_coverage_zones");
});
