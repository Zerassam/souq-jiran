import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "..");

describe("Souq Jiran Supabase integration", () => {
  it("documents the required role tables and row-level access policies", () => {
    const schema = readFileSync(resolve(projectRoot, "supabase/schema.sql"), "utf8").toLowerCase();

    expect(schema).toContain("create table if not exists public.profiles");
    expect(schema).toContain("create table if not exists public.merchants");
    expect(schema).toContain("create table if not exists public.couriers");
    expect(schema).toContain("alter table public.profiles enable row level security");
    expect(schema).toContain("handle_new_user");
    expect(schema).toContain("create table if not exists public.products");
    expect(schema).toContain("create table if not exists public.order_items");
    expect(schema).toContain("create or replace function public.create_customer_order");
    expect(schema).toContain("create or replace function public.admin_set_provider_status");
    expect(schema).toContain("products_manage_owner_or_admin");
    expect(schema).toContain("listportail@gmail.com");
  });

  it("uses Supabase Auth instead of a browser-stored password lookup", () => {
    const appSource = readFileSync(resolve(projectRoot, "client/src/pages/SouqJiranApp.jsx"), "utf8");

    expect(appSource).toContain("supabase.auth.signInWithPassword");
    expect(appSource).toContain("supabase.auth.signUp");
    expect(appSource).toContain("supabase.auth.onAuthStateChange");
    expect(appSource).not.toContain("STORAGE.auth");
    expect(appSource).not.toContain("STORAGE.accounts");
    expect(appSource).toContain("supabase.rpc(\"create_customer_order\"");
    expect(appSource).toContain("supabase.rpc(\"admin_set_provider_status\"");
    expect(appSource).not.toContain("ADMIN_PASSWORD");
    expect(appSource).not.toContain("AdminGateModal");
  });

  it("retries the initial courier profile insertion once after refreshing a newly created session", () => {
    const appSource = readFileSync(resolve(projectRoot, "client/src/pages/SouqJiranApp.jsx"), "utf8");

    expect(appSource).toContain('let { error: courierError } = await supabase.from("couriers").insert(courier)');
    expect(appSource).toContain('if (courierError?.code === "42501")');
    expect(appSource).toContain("supabase.auth.refreshSession()");
    expect(appSource).toContain('const retry = await supabase.from("couriers").insert(courier)');
    expect(appSource).toContain("await applySupabaseSession(activeSession)");
  });

  it("keeps courier discovery private while allowing customers to select platform delivery", () => {
    const schema = readFileSync(resolve(projectRoot, "supabase/schema.sql"), "utf8");
    const appSource = readFileSync(resolve(projectRoot, "client/src/pages/SouqJiranApp.jsx"), "utf8");
    const customerView = appSource.match(/function CustomerView[\s\S]*?(?=function MerchantView)/)?.[0] ?? "";

    expect(schema).toContain("for select to authenticated using (");
    expect(schema).toContain("public.current_app_role() = 'merchant'");
    expect(customerView).toContain("const platformCourierEnabled");
    expect(customerView).toContain("يُسند تلقائياً عند الجاهزية");
    expect(customerView).not.toContain("const courierAssigned = deliveryChoice");
    expect(customerView).not.toContain('from("couriers").select');
  });

  it("keeps the admin order monitor read-only when no persisted confirmation action exists", () => {
    const appSource = readFileSync(resolve(projectRoot, "client/src/pages/SouqJiranApp.jsx"), "utf8");

    expect(appSource).toContain("function AdminView");
    expect(appSource).toContain("متابعة الطلبات المباشرة");
    expect(appSource).not.toContain("confirmOrder(");
  });

  it("renders an administrative status badge safely when persisted data has an unknown state", () => {
    const appSource = readFileSync(resolve(projectRoot, "client/src/pages/SouqJiranApp.jsx"), "utf8");

    expect(appSource).toContain('STATUS_MAP[status] ?? { label: "بانتظار التحديث", color: C.inkSoft }');
  });

  it("defines per-user archives while reserving permanent deletion for the Supabase admin role", () => {
    const schema = readFileSync(resolve(projectRoot, "supabase/schema.sql"), "utf8").toLowerCase();
    const appSource = readFileSync(resolve(projectRoot, "client/src/pages/SouqJiranApp.jsx"), "utf8");

    expect(schema).toContain("create table if not exists public.order_user_archives");
    expect(schema).toContain("create table if not exists public.order_messages");
    expect(schema).toContain("create or replace function public.archive_order_for_user");
    expect(schema).toContain("create or replace function public.archive_message_for_user");
    expect(schema).toContain("create or replace function public.admin_delete_order_permanently");
    expect(schema).toContain("create or replace function public.admin_delete_message_permanently");
    expect(schema).toContain("is_app_admin()");
    expect(appSource).toContain("archiveOrderForCurrentUser");
    expect(appSource).toContain("deleteOrderPermanently");
    expect(appSource).toContain("أرشيف السجلات الكامل");
    expect(appSource).toContain('data-testid="archive-search-filters"');
  });

  it("keeps the public header free of a customer switch and gates admin sign-in behind its discreet entry", () => {
    const appSource = readFileSync(resolve(projectRoot, "client/src/pages/SouqJiranApp.jsx"), "utf8");

    expect(appSource).toContain('adminOnly={adminLoginRequested}');
    expect(appSource).toContain('aria-label="دخول الإدارة"');
    expect(appSource).toContain('setAdminLoginRequested(true)');
    expect(appSource).not.toContain('><User size={16} /> عميل</button>');
  });

  it("requires explicit confirmation before an admin permanently removes archived data", () => {
    const appSource = readFileSync(resolve(projectRoot, "client/src/pages/SouqJiranApp.jsx"), "utf8");

    expect(appSource).toContain('window.confirm("سيُحذف الطلب نهائياً مع عناصره ورسائله ولا يمكن استعادته. هل تريد المتابعة؟")');
    expect(appSource).toContain('window.confirm("سيُحذف محتوى الرسالة نهائياً ولا يمكن استعادته. هل تريد المتابعة؟")');
    expect(appSource).toContain('supabase.rpc("admin_delete_order_permanently"');
    expect(appSource).toContain('supabase.rpc("admin_delete_message_permanently"');
  });

  it("moves merchant and courier actions into the lower join cards and keeps the public header minimal", () => {
    const appSource = readFileSync(resolve(projectRoot, "client/src/pages/SouqJiranApp.jsx"), "utf8");
    const providerSwitchIndex = appSource.indexOf('data-testid="provider-role-switches"');
    const providerSwitchSource = appSource.slice(providerSwitchIndex, providerSwitchIndex + 2200);
    const publicHeaderSource = appSource.slice(
      appSource.indexOf('<div className="max-w-5xl mx-auto px-4 py-5">'),
      appSource.indexOf("<StripeDivider />"),
    );

    expect(providerSwitchIndex).toBeGreaterThan(-1);
    expect(providerSwitchSource).toContain('data-testid="courier-role-button"');
    expect(providerSwitchSource).toContain('data-testid="merchant-role-button"');
    expect(appSource).toContain('data-testid="role-join-cards"');
    expect(appSource).toContain("انضم كتاجر");
    expect(appSource).toContain("انضم كموصل");
    expect(appSource.indexOf('data-testid="role-join-cards"')).toBeGreaterThan(appSource.indexOf("<CustomerView"));
    expect(publicHeaderSource).not.toContain("دخول بالإيميل");
    expect(publicHeaderSource).not.toContain("<NotificationsBell");
    expect(publicHeaderSource).not.toContain("إعادة ضبط");
    expect(providerSwitchSource).not.toContain('> عميل</button>');
  });

  it("provides an accessible role benefits page and explicit new-order counters for providers", () => {
    const appSource = readFileSync(resolve(projectRoot, "client/src/pages/SouqJiranApp.jsx"), "utf8");

    expect(appSource).toContain('data-testid="role-benefits-link"');
    expect(appSource).toContain('data-testid="role-benefits-page"');
    expect(appSource).toContain("انضم إلى شبكة الحيّ");
    expect(appSource).toContain("إدارة المنتجات والمخزون");
    expect(appSource).toContain("أوقات عمل مرنة");
    expect(appSource).toContain("role-join-card:hover");
    expect(appSource).toContain("prefers-reduced-motion");
    expect(appSource).toContain('data-testid="merchant-new-orders-counter"');
    expect(appSource).toContain('data-testid="courier-new-orders-counter"');
    expect(appSource).toContain("const newMerchantOrders");
    expect(appSource).toContain("const newAvailableOrdersCount");
    expect(appSource).toContain('o.status === "pending"');
    expect(appSource).toContain('o.deliveryType !== "courier" || o.status !== "ready" || o.courier');
    expect(appSource).toContain('courier.storeMode === "selected"');
    expect(appSource).toContain('aria-label={`${newMerchantOrders.length} طلبات جديدة`}');
    expect(appSource).toContain('aria-label={`${newAvailableOrdersCount} طلبات جديدة متاحة`}');
  });

  it("connects new-order counters to focused order views and preserves the courier status filter", () => {
    const appSource = readFileSync(resolve(projectRoot, "client/src/pages/SouqJiranApp.jsx"), "utf8");

    expect(appSource).toContain('data-testid="merchant-new-orders-link"');
    expect(appSource).toContain('data-testid="courier-new-orders-link"');
    expect(appSource).toContain("openNewMerchantOrders");
    expect(appSource).toContain('selectCourierOrderFilter("ready")');
    expect(appSource).toContain('data-testid="courier-order-status-filter"');
    expect(appSource).toContain('"souq-jiran:courier-order-filter"');
    expect(appSource).toContain("window.sessionStorage.setItem");
  });

  it("keeps test-account review restricted to explicit qa accounts with a confirmed admin deletion path", () => {
    const appSource = readFileSync(resolve(projectRoot, "client/src/pages/SouqJiranApp.jsx"), "utf8");
    const migration = readFileSync(resolve(projectRoot, "supabase/migrations/20260819_test_account_review.sql"), "utf8");
    const activityMigration = readFileSync(resolve(projectRoot, "supabase/migrations/20260820_test_account_review_last_activity.sql"), "utf8");
    const schema = readFileSync(resolve(projectRoot, "supabase/schema.sql"), "utf8");

    expect(appSource).toContain('data-testid="test-account-review-panel"');
    expect(appSource).toContain('supabase.rpc("admin_list_test_accounts")');
    expect(appSource).toContain('supabase.rpc("admin_delete_test_account"');
    expect(appSource).toContain("سيُحذف حساب الاختبار");
    expect(migration).toContain("test_account_review_audit_logs");
    expect(migration).toContain("admin_list_test_accounts");
    expect(migration).toContain("admin_delete_test_account");
    expect(migration).toContain("drop function if exists public.admin_list_test_accounts()");
    expect(migration).toContain("public.is_app_admin()");
    expect(migration).toContain("u.email::text");
    expect(migration).toContain("p.role::text");
    expect(migration).not.toContain("public.is_admin(auth.uid())");
    expect(migration).toContain("^qa-(merchant|courier)");
    expect(migration).toContain("not exists (");
    expect(appSource).toContain('data-testid="test-account-review-search"');
    expect(appSource).toContain('data-testid="test-account-review-audit"');
    expect(appSource).toContain('data-testid="test-account-review-csv-export"');
    expect(appSource).toContain("exportTestAccountReviewCSV");
    expect(appSource).toContain("escapeCSVCell");
    expect(appSource).toContain('supabase.from("test_account_review_audit_logs")');
    expect(appSource).toContain("formatRelativeActivity");
    expect(appSource).toContain("lastActivityLabel");
    expect(activityMigration).toContain("last_sign_in_at");
    expect(activityMigration).toContain("u.email::text");
    expect(activityMigration).toContain("p.role::text");
    expect(schema).toContain("u.email::text");
    expect(schema).toContain("p.role::text");
    expect(activityMigration).toContain("public.is_app_admin()");
    expect(activityMigration).not.toContain("public.is_admin(auth.uid())");
    expect(activityMigration).toContain("admin access required");
  });

  it("defines protected audit and notification flows for archive management", () => {
    const schema = readFileSync(resolve(projectRoot, "supabase/schema.sql"), "utf8").toLowerCase();
    const migration = readFileSync(resolve(projectRoot, "supabase/migrations/20260818_archive_management.sql"), "utf8").toLowerCase();
    const appSource = readFileSync(resolve(projectRoot, "client/src/pages/SouqJiranApp.jsx"), "utf8");

    expect(schema).toContain("create table if not exists public.admin_archive_audit_logs");
    expect(schema).toContain("create table if not exists public.admin_archive_notifications");
    expect(schema).toContain("admin_mark_archive_notification_read");
    expect(schema).toContain("notify_on_message_archive");
    expect(schema).toContain("'message_archive'");
    expect(migration).toContain("create or replace function public.archive_message_for_user");
    expect(migration).toContain("'message_archive'");
    expect(appSource).toContain('data-testid="archive-search-filters"');
    expect(appSource).toContain('data-testid="archive-alerts-panel"');
    expect(appSource).toContain('data-testid="archive-audit-log"');
    expect(appSource).toContain("markArchiveNotificationRead");
  });

  it("records protected admin notifications for new and delivered orders with their totals", () => {
    const schema = readFileSync(resolve(projectRoot, "supabase/schema.sql"), "utf8");
    const migration = readFileSync(resolve(projectRoot, "supabase/migrations/20260821_admin_order_notifications.sql"), "utf8");
    const appSource = readFileSync(resolve(projectRoot, "client/src/pages/SouqJiranApp.jsx"), "utf8");

    expect(schema).toContain("create table if not exists public.admin_order_notifications");
    expect(schema).toContain("record_admin_order_notification");
    expect(schema).toContain("admin_mark_order_notification_read");
    expect(schema).toContain("admin_mark_all_order_notifications_read");
    expect(schema).toContain("'order_created'");
    expect(schema).toContain("'order_delivered'");
    expect(schema).toContain("public.is_app_admin()");
    expect(migration).toContain("perform public.record_admin_order_notification(v_order.id, 'order_created')");
    expect(migration).toContain("perform public.record_admin_order_notification(v_order.id, 'order_delivered')");
    expect(migration).toContain("order_total integer not null check (order_total >= 0)");
    expect(migration).toContain("alter publication supabase_realtime add table public.admin_order_notifications");
    expect(appSource).toContain('data-testid="admin-order-notifications-panel"');
    expect(appSource).toContain('supabase.from("admin_order_notifications")');
    expect(appSource).toContain('supabase.rpc("admin_mark_order_notification_read"');
    expect(appSource).toContain('supabase.rpc("admin_mark_all_order_notifications_read")');
    expect(appSource).toContain("إشعارات الطلبات");
  });

  it("defines the advanced order lifecycle, geographic quote, and administrative safeguards", () => {
    const schema = readFileSync(resolve(projectRoot, "supabase/schema.sql"), "utf8");
    const migration = readFileSync(resolve(projectRoot, "supabase/migrations/20260822_advanced_order_lifecycle.sql"), "utf8");

    expect(schema).toContain("20260822_advanced_order_lifecycle.sql");
    expect(migration).toContain("customer_phone_verifications");
    expect(migration).toContain("customer_behavior_reports");
    expect(migration).toContain("customer_blacklist");
    expect(migration).toContain("delivery_pricing_config");
    expect(migration).toContain("quote_delivery");
    expect(migration).toContain("courier_confirm_pickup");
    expect(migration).toContain("courier_start_delivery");
    expect(migration).toContain("courier_confirm_delivery");
    expect(migration).toContain("customer_confirm_delivery");
    expect(migration).toContain("courier_confirm_remittance");
    expect(migration).toContain("merchant_confirm_settlement");
    expect(migration).toContain("requires_phone_verification");
    expect(migration).toContain("is_interwilaya");
  });

  it("wires the customer, courier, and merchant interfaces to the advanced lifecycle without real OTP claims", () => {
    const appSource = readFileSync(resolve(projectRoot, "client/src/pages/SouqJiranApp.jsx"), "utf8");
    const customerView = appSource.match(/function CustomerView[\s\S]*?(?=function OrderTracker)/)?.[0] ?? "";

    expect(customerView).toContain("تسعير محسوب من الخادم");
    expect(customerView).toContain("هذا وضع تجريبي معلن");
    expect(customerView).toContain("فتح WhatsApp");
    expect(customerView).toContain("فتح Viber");
    expect(customerView).toContain("customerConfirmDelivery");
    expect(appSource).toContain('supabase.rpc("quote_delivery"');
    expect(appSource).toContain('supabase.rpc("confirm_customer_phone_verification"');
    expect(appSource).toContain('"courier_confirm_pickup"');
    expect(appSource).toContain('"courier_start_delivery"');
    expect(appSource).toContain('"courier_confirm_delivery"');
    expect(appSource).toContain('"customer_confirm_delivery"');
    expect(appSource).toContain('"courier_confirm_remittance"');
    expect(appSource).toContain('"merchant_confirm_settlement"');
    expect(appSource).toContain("تأكيد تحويل المستحقات للتاجر");
    expect(appSource).toContain("تأكيد استلام المستحقات");
  });

  it("loads reports, blacklist entries, and delivery pricing only for the protected admin tools", () => {
    const appSource = readFileSync(resolve(projectRoot, "client/src/pages/SouqJiranApp.jsx"), "utf8");

    expect(appSource).toContain('from("customer_behavior_reports")');
    expect(appSource).toContain('from("customer_blacklist")');
    expect(appSource).toContain('from("delivery_pricing_config")');
    expect(appSource).toContain('supabase.rpc("admin_set_customer_blacklist"');
    expect(appSource).toContain('data-testid="advanced-order-admin-panel"');
    expect(appSource).toContain("حظر الحساب");
    expect(appSource).toContain("حفظ إعدادات التسعير");
    expect(appSource).toContain("auth?.type !== \"admin\"");
  });

  it("keeps automated messaging in an explicit local mock mode until a provider is configured", () => {
    const appSource = readFileSync(resolve(projectRoot, "client/src/pages/SouqJiranApp.jsx"), "utf8");

    expect(appSource).toContain('mockMessaging: { key: "souq-jiran:mock-messaging:v1", shared: true }');
    expect(appSource).toContain("function recordMockMessage");
    expect(appSource).toContain('data-testid="admin-mock-messaging-panel"');
    expect(appSource).toContain("لا تُرسل أي رسالة خارج التطبيق");
    expect(appSource).toContain("لا تحفظ المفاتيح في هذه الشاشة أو في window.storage");
    expect(appSource).toContain("courier_confirm_pickup");
    expect(appSource).toContain("courier_start_delivery");
    expect(appSource).toContain("courier_confirm_delivery");
    expect(appSource).toContain("customer_confirm_delivery");
    expect(appSource).toContain("courier_confirm_remittance");
    expect(appSource).toContain("merchant_confirm_settlement");
    expect(appSource).toContain("رمز OTP تجريبي: 123456");
  });
});
