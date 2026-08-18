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

  it("keeps the admin order monitor read-only when no persisted confirmation action exists", () => {
    const appSource = readFileSync(resolve(projectRoot, "client/src/pages/SouqJiranApp.jsx"), "utf8");

    expect(appSource).toContain("function AdminView");
    expect(appSource).toContain("متابعة الطلبات المباشرة");
    expect(appSource).not.toContain("confirmOrder(");
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
});
