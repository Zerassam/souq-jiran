import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "..");

describe("Souq Jiran Supabase integration", () => {
  it("uses verified Supabase email OTP in the unified authentication modal without Firebase SMS or demo codes", () => {
    const appSource = readFileSync(resolve(projectRoot, "client/src/pages/SouqJiranApp.jsx"), "utf8");
    const authModalStart = appSource.indexOf("function AuthModal");
    const authModalEnd = appSource.indexOf("\nfunction ", authModalStart + 1);
    const authModalSource = appSource.slice(authModalStart, authModalEnd);
    const supabaseSource = readFileSync(resolve(projectRoot, "client/src/lib/supabase.ts"), "utf8");

    expect(authModalSource).toContain("supabase.auth.signInWithOtp");
    expect(authModalSource).toContain("supabase.auth.verifyOtp");
    expect(authModalSource).toContain('type: "email"');
    expect(authModalSource).toContain("أدخل رمز التحقق الذي وصلك إلى بريدك الإلكتروني.");
    expect(authModalSource).toContain("verifiedSession");
    expect(authModalSource).not.toContain("beginFirebasePhoneVerification");
    expect(authModalSource).not.toContain("completeFirebasePhoneVerification");
    expect(authModalSource).not.toContain("رمز SMS");
    expect(authModalSource).not.toContain("mockOtpCode");
    expect(authModalSource).not.toContain('"123456"');
    expect(supabaseSource).not.toContain("firebaseSupabase");
    expect(authModalSource).not.toContain("phoneRequestInFlightRef");
    expect(authModalSource).not.toContain("resetPhoneVerification");
  });

  it("keeps FCM tokens restricted to the active Supabase profile and configures Android permission support", () => {
    const appSource = readFileSync(resolve(projectRoot, "client/src/pages/SouqJiranApp.jsx"), "utf8");
    const firebaseSource = readFileSync(resolve(projectRoot, "client/src/lib/firebase.ts"), "utf8");
    const migration = readFileSync(resolve(projectRoot, "supabase/migrations/20260827_firebase_fcm_columns.sql"), "utf8");
    const capacitorConfig = readFileSync(resolve(projectRoot, "capacitor.config.ts"), "utf8");
    const manifest = readFileSync(resolve(projectRoot, "android/app/src/main/AndroidManifest.xml"), "utf8");

    expect(appSource).toContain('supabase.rpc("update_my_fcm_token"');
    expect(appSource).toContain("listenForNativeFcmToken");
    expect(firebaseSource).toContain("FirebaseMessaging.requestPermissions");
    expect(firebaseSource).toContain("FirebaseMessaging.getToken");
    expect(firebaseSource).toContain("requestGoogleProfilePrefill");
    expect(firebaseSource).not.toContain("signInWithPhoneNumber");
    expect(firebaseSource).not.toContain("RecaptchaVerifier");
    expect(firebaseSource).not.toContain("FirebaseAuthentication.confirmVerificationCode");
    expect(migration).toContain("phone_verified_at timestamptz");
    expect(migration).toContain("fcm_token text");
    expect(migration).toContain("record_my_firebase_phone");
    expect(migration).toContain("update_my_fcm_token");
    expect(migration).toContain("if auth.uid() is null then");
    expect(migration).toContain("raise exception 'Authentication required';");
    expect(capacitorConfig).toContain("FirebaseAuthentication");
    expect(capacitorConfig).toContain("FirebaseMessaging");
    expect(manifest).toContain('android.permission.POST_NOTIFICATIONS');
  });

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

  it("uses Supabase email OTP instead of browser-stored credentials or password login", () => {
    const appSource = readFileSync(resolve(projectRoot, "client/src/pages/SouqJiranApp.jsx"), "utf8");

    expect(appSource).toContain("supabase.auth.signInWithOtp");
    expect(appSource).toContain("supabase.auth.verifyOtp");
    expect(appSource).not.toContain("supabase.auth.signInWithPassword");
    expect(appSource).not.toContain("supabase.auth.signUp");
    expect(appSource).toContain("supabase.auth.onAuthStateChange");
    expect(appSource).not.toContain("STORAGE.auth");
    expect(appSource).not.toContain("STORAGE.accounts");
    expect(appSource).toContain("supabase.rpc(\"create_customer_order\"");
    expect(appSource).toContain("supabase.rpc(\"admin_set_provider_status\"");
    expect(appSource).not.toContain("ADMIN_PASSWORD");
    expect(appSource).not.toContain("AdminGateModal");
  });

  it("creates merchant and courier records only after a verified email OTP session", () => {
    const appSource = readFileSync(resolve(projectRoot, "client/src/pages/SouqJiranApp.jsx"), "utf8");

    expect(appSource).toContain("function ProviderEmailOtpModal");
    expect(appSource).toContain("onVerified={({ type, form, verifiedSession })");
    expect(appSource).toContain('if (!form.verifiedSession?.user) { setPendingProviderRegistration({ type: "merchant", form }); return { pendingOtp: true }; }');
    expect(appSource).toContain('if (!form.verifiedSession?.user) { setPendingProviderRegistration({ type: "courier", form }); return { pendingOtp: true }; }');
    expect(appSource).toContain('supabase.auth.verifyOtp({ email, token: otpCode, type: "email" })');
    expect(appSource).not.toContain('type="password"');
    expect(appSource).not.toContain("form.password");
    expect(appSource).not.toContain("OTP تجريبي");
    expect(appSource).not.toContain("اختر محلك للتجربة");
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

  it("keeps three independent account gates in the lower join cards and the public header minimal", () => {
    const appSource = readFileSync(resolve(projectRoot, "client/src/pages/SouqJiranApp.jsx"), "utf8");
    const providerSwitchIndex = appSource.indexOf('data-testid="provider-role-switches"');
    const providerSwitchSource = appSource.slice(providerSwitchIndex, providerSwitchIndex + 6000);
    const publicHeaderSource = appSource.slice(
      appSource.indexOf('<div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 sm:py-7">'),
      appSource.indexOf("<StripeDivider />"),
    );

    expect(providerSwitchIndex).toBeGreaterThan(-1);
    expect(providerSwitchSource).toContain('data-testid="courier-role-button"');
    expect(providerSwitchSource).toContain('data-testid="merchant-role-button"');
    expect(providerSwitchSource).toContain('data-testid="customer-role-button"');
    expect(providerSwitchSource).toContain('data-testid="courier-login-button"');
    expect(appSource).toContain('data-testid="role-join-cards"');
    expect(appSource).toContain("انضم كتاجر");
    expect(appSource).toContain("انضم كموصل");
    expect(appSource).toContain("حساب الزبون");
    expect(appSource.indexOf('data-testid="role-join-cards"')).toBeGreaterThan(appSource.indexOf("<CustomerView"));
    expect(publicHeaderSource).not.toContain("دخول بالإيميل");
    expect(publicHeaderSource).not.toContain("<NotificationsBell");
    expect(publicHeaderSource).not.toContain("إعادة ضبط");
    expect(appSource).toContain("function MerchantRegisterModal");
    expect(appSource).toContain("function CourierRegisterModal");
    expect(appSource).toContain("lockRole = true");
    expect(appSource).toContain("!lockRole && <div");
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

  it("wires the customer, courier, and merchant interfaces to the advanced lifecycle with verified email eligibility", () => {
    const appSource = readFileSync(resolve(projectRoot, "client/src/pages/SouqJiranApp.jsx"), "utf8");
    const customerView = appSource.match(/function CustomerView[\s\S]*?(?=function OrderTracker)/)?.[0] ?? "";

    expect(customerView).toContain("تسعير محسوب من الخادم");
    expect(customerView).toContain("تأكيد الحساب عبر البريد الإلكتروني");
    expect(customerView).toContain("emailVerified");
    expect(customerView).not.toContain("واتساب/فايبر");
    expect(customerView).not.toContain("التحويل إلى Viber");
    expect(customerView).toContain("customerConfirmDelivery");
    expect(appSource).toContain('supabase.rpc("quote_delivery"');
    expect(appSource).not.toContain('supabase.rpc("confirm_customer_phone_verification"');
    expect(appSource).not.toContain('supabase.rpc("request_customer_phone_verification"');
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

  it("removes local mock messaging and sample OTP values from production account flows", () => {
    const appSource = readFileSync(resolve(projectRoot, "client/src/pages/SouqJiranApp.jsx"), "utf8");

    expect(appSource).not.toContain('mockMessaging: { key: "souq-jiran:mock-messaging:v1", shared: true }');
    expect(appSource).not.toContain("function recordMockMessage");
    expect(appSource).not.toContain('data-testid="admin-mock-messaging-panel"');
    expect(appSource).not.toContain("لا تُرسل أي رسالة خارج التطبيق");
    expect(appSource).toContain("courier_confirm_pickup");
    expect(appSource).toContain("courier_start_delivery");
    expect(appSource).toContain("courier_confirm_delivery");
    expect(appSource).toContain("customer_confirm_delivery");
    expect(appSource).toContain("courier_confirm_remittance");
    expect(appSource).toContain("merchant_confirm_settlement");
    expect(appSource).not.toContain("رمز OTP تجريبي: 123456");
  });

  it("defines privacy-preserving QR, referral, and reward flows tied to a settled first order", () => {
    const appSource = readFileSync(resolve(projectRoot, "client/src/pages/SouqJiranApp.jsx"), "utf8");
    const migration = readFileSync(resolve(projectRoot, "supabase/migrations/20260823_qr_referrals_rewards.sql"), "utf8");

    expect(migration).toContain("create table if not exists public.customer_referrals");
    expect(migration).toContain("create table if not exists public.reward_coupons");
    expect(migration).toContain("create or replace function public.ensure_my_referral_code()");
    expect(migration).toContain("create or replace function public.claim_customer_referral(p_referral_code text)");
    expect(migration).toContain("create or replace function public.redeem_reward_coupon(p_order_id uuid, p_coupon_code text)");
    expect(migration).toContain("create or replace function public.award_referral_for_settled_order(p_order_id uuid)");
    expect(migration).toContain("perform public.award_referral_for_settled_order(v.id)");
    expect(migration).toContain("referrer_id <> referred_customer_id");
    expect(migration).toContain("لا يخزن هذا الامتداد أرقام الهواتف");
    expect(appSource).toContain("MerchantQrPoster");
    expect(appSource).toContain("jsPDF");
    expect(appSource).toContain("ReferralRewardsPanel");
    expect(appSource).toContain('supabase.rpc("claim_customer_referral"');
    expect(appSource).toContain('supabase.rpc("redeem_reward_coupon"');
    expect(appSource).not.toContain("recordMockMessage");
  });

  it("provides monthly CSV export and configurable coupon redemption rate alert for admin", () => {
    const appSource = readFileSync(resolve(projectRoot, "client/src/pages/SouqJiranApp.jsx"), "utf8");

    expect(appSource).toContain("exportMonthlyReferralCSV");
    expect(appSource).toContain("couponRedemptionThreshold");
    expect(appSource).toContain("couponRateAlert");
    expect(appSource).toContain('data-testid="coupon-redemption-alert"');
    expect(appSource).toContain('aria-label="حد تنبيه معدل الاسترداد"');
    expect(appSource).toContain("تنزيل تقرير CSV الشهري");
    expect(appSource).toContain("souq-jiran-coupon-redemption-threshold");
    expect(appSource).toContain("تنبيه إداري: معدل الاسترداد بلغ الحد أو تجاوزه");
  });

  it("keeps merchant registration compatible with browsers that do not support Object.groupBy", () => {
    const appSource = readFileSync(resolve(projectRoot, "client/src/pages/SouqJiranApp.jsx"), "utf8");

    expect(appSource).toContain("function groupRowsBy(rows, keySelector)");
    expect(appSource).toContain("const productsByMerchant = groupRowsBy(productRows");
    expect(appSource).toContain("const itemsByOrder = groupRowsBy(itemsResult.data || []");
    expect(appSource).not.toContain("Object.groupBy");
    expect(appSource).toContain("finally {");
    expect(appSource).toContain("setIsSubmitting(false);");
  });

  it("keeps normalized Algerian phones for login while separating required registration email and phone fields", () => {
    const appSource = readFileSync(resolve(projectRoot, "client/src/pages/SouqJiranApp.jsx"), "utf8");

    expect(appSource).toContain("function normalizeAlgerianMobile");
    expect(appSource).toContain("function parseLoginIdentifier");
    expect(appSource).toContain("/^0[567]\\d{8}$/");
    expect(appSource).toContain("/^\\+213[567]\\d{8}$/");
    expect(appSource).toContain('data-testid="auth-identifier-input"');
    expect(appSource).toContain('data-testid="merchant-email-input"');
    expect(appSource).toContain('data-testid="courier-email-input"');
    expect(appSource).toContain('type="email" autoComplete="email"');
    expect(appSource).toContain('placeholder="رقم الهاتف للتواصل (05/06/07)"');
    expect(appSource).not.toContain("رمز OTP التجريبي 123456");
  });

  it("provides account recovery and communication-phone updates within an email-verified session", () => {
    const appSource = readFileSync(resolve(projectRoot, "client/src/pages/SouqJiranApp.jsx"), "utf8");

    expect(appSource).toContain("function requestAccountRecovery");
    expect(appSource).toContain("options: { shouldCreateUser: false }");
    expect(appSource).not.toContain("resetPasswordForEmail");
    expect(appSource).toContain("function PhoneChangeModal");
    expect(appSource).toContain('aria-label="رقم الهاتف الجديد"');
    expect(appSource).toContain('supabase.from("profiles").update({ phone: normalizedPhone })');
    expect(appSource).toContain("supabase.auth.updateUser({ data: { phone: normalizedPhone } })");
    expect(appSource).toContain("ضمن جلسة بريد إلكتروني موثقة");
    expect(appSource).not.toContain("request_my_firebase_phone_link");
    expect(appSource).not.toContain("confirm_my_firebase_phone_link");
    expect(appSource).not.toContain('"firebase-phone-change-recaptcha"');
    expect(appSource).not.toContain("completeFirebasePhoneVerification(phoneVerification, otp)");
  });

  it("validates the supplied Firebase Auth API key without creating an account", async () => {
    const apiKey = process.env.VITE_FIREBASE_API_KEY;
    const projectId = process.env.VITE_FIREBASE_PROJECT_ID;

    expect(apiKey).toBeTruthy();
    expect(projectId).toBe("souq-jiran");

    const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
      signal: AbortSignal.timeout(10_000),
    });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(JSON.stringify(payload)).toContain("MISSING_ID_TOKEN");
  }, 12_000);

  it("does not expose Firebase SMS verification in production account flows", () => {
    const appSource = readFileSync(resolve(projectRoot, "client/src/pages/SouqJiranApp.jsx"), "utf8");

    expect(appSource).toContain("supabase.auth.signInWithOtp");
    expect(appSource).toContain("supabase.auth.verifyOtp");
    expect(appSource).not.toContain("beginFirebasePhoneVerification");
    expect(appSource).not.toContain("completeFirebasePhoneVerification");
    expect(appSource).not.toContain("Firebase SMS");
    expect(appSource).not.toContain("رمز SMS");
    expect(appSource).not.toContain("firebase-phone-change-recaptcha");
  });

  it("creates a pending courier review request from unified registration and exposes it to administrators", () => {
    const appSource = readFileSync(resolve(projectRoot, "client/src/pages/SouqJiranApp.jsx"), "utf8");
    const courierPolicyMigration = readFileSync(resolve(projectRoot, "supabase/migrations/20260828_admin_courier_visibility.sql"), "utf8");

    expect(appSource).toContain("function ensureCourierReviewRequest");
    expect(appSource).toContain('supabase.from("couriers").upsert');
    expect(appSource).toContain('status: "pending"');
    expect(appSource).toContain('if (type === "courier")');
    expect(appSource).toContain("تم إنشاء حساب الموصل وإرسال طلبه إلى لوحة الإدارة للمراجعة.");
    expect(courierPolicyMigration).toContain("couriers_admin_read");
    expect(courierPolicyMigration).toContain("public.is_app_admin()");
  });

  it("wires the specialized merchant registration, courier QR identity, broad search, maps, and Android location permissions", () => {
    const appSource = readFileSync(resolve(projectRoot, "client/src/pages/SouqJiranApp.jsx"), "utf8");
    const mapSource = readFileSync(resolve(projectRoot, "client/src/components/Map.tsx"), "utf8");
    const manifest = readFileSync(resolve(projectRoot, "android/app/src/main/AndroidManifest.xml"), "utf8");

    expect(appSource).toContain("function MerchantRegisterModal");
    expect(appSource).toContain("setShowMerchantForm(true)");
    expect(appSource).toContain("إرسال طلب انضمام المحل");
    expect(appSource).toContain("QRCode.toDataURL(deepLink");
    expect(appSource).toContain("رمز QR الخاص بملف الموصل");
    expect(appSource).toContain("normalizeSearchText");
    expect(appSource).toContain("MapView");
    expect(mapSource).toContain("onMapError");
    expect(manifest).toContain("android.permission.ACCESS_COARSE_LOCATION");
    expect(manifest).toContain("android.permission.ACCESS_FINE_LOCATION");
  });

  it("keeps local discovery concise, preserves courier privacy, and never seeds public feedback", () => {
    const appSource = readFileSync(resolve(projectRoot, "client/src/pages/SouqJiranApp.jsx"), "utf8");

    expect(appSource).toContain("const MAX_DISCOVERY_STORES = 6");
    expect(appSource).toContain("const MAX_DISCOVERY_COURIERS = 2");
    expect(appSource).toContain("function curateDiscoveryStores");
    expect(appSource).toContain("data-testid=\"nearby-couriers-panel\"");
    expect(appSource).toContain("موصل المنصة");
    expect(appSource).toContain("data-testid=\"verified-feedback-panel\"");
    expect(appSource).toContain("review?.verified === true");
    expect(appSource).not.toContain('comment: "خدمة سريعة ومنتجات طازجة"');
    expect(appSource).not.toContain('comment: "أسعار ممتازة"');
    expect(appSource).not.toContain('comment: "توصيل سريع"');
  });

  it("keeps automatic Firebase Auth custom claims in trusted server-side code", () => {
    const triggerSource = readFileSync(
      resolve(projectRoot, "firebase-functions", "index.cjs"),
      "utf8",
    );
    const firebaseConfig = readFileSync(resolve(projectRoot, "firebase.json"), "utf8");

    expect(triggerSource).toContain('require("firebase-functions/v1")');
    expect(triggerSource).toContain(".auth.user()");
    expect(triggerSource).toContain(".onCreate(async (user)");
    expect(triggerSource).toContain("getAuth().setCustomUserClaims");
    expect(triggerSource).toContain('role: "authenticated"');
    expect(triggerSource).toContain("...existingClaims");
    expect(firebaseConfig).toContain('"source": "firebase-functions"');
    expect(firebaseConfig).toContain('"runtime": "nodejs22"');
  });
});
