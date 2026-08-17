import { chromium } from "@playwright/test";

const baseUrl = process.env.E2E_BASE_URL || "http://127.0.0.1:3000";
const runId = Date.now();

const merchant = {
  email: `ui.merchant.${runId}@example.invalid`,
  password: `UiMerchant-${runId}-Test`,
  storeName: `UI Merchant ${runId}`,
};

const courier = {
  email: `ui.courier.${runId}@example.invalid`,
  password: `UiCourier-${runId}-Test`,
  name: `UI Courier ${runId}`,
};

async function expectVisible(locator, label) {
  await locator.waitFor({ state: "visible", timeout: 15_000 });
  if (!(await locator.isVisible())) throw new Error(`Expected visible: ${label}`);
}

async function chooseFirstWilayaAndCommune(scope) {
  const selects = scope.locator("select");
  await selects.nth(0).selectOption({ index: 1 });
  await selects.nth(1).selectOption({ index: 1 });
}

async function signInThroughModal(page, { email, password, role }) {
  await page.getByRole("button", { name: "دخول بالإيميل" }).click();
  const authModal = page.locator("div.fixed").last();
  if (role === "courier") await authModal.getByRole("button", { name: "موصّل", exact: true }).click();
  await authModal.getByPlaceholder("البريد الإلكتروني").fill(email);
  await authModal.getByPlaceholder("كلمة المرور").fill(password);
  await authModal.getByRole("button", { name: "تسجيل الدخول" }).click();
}

const browser = await chromium.launch({ headless: true });
try {
  const merchantContext = await browser.newContext();
  const merchantPage = await merchantContext.newPage();
  await merchantPage.goto(baseUrl, { waitUntil: "networkidle" });

  // Merchant: create authentication identity, then complete the store record from the merchant UI.
  await merchantPage.getByRole("button", { name: "دخول بالإيميل" }).click();
  await merchantPage.getByRole("button", { name: "حساب جديد" }).click();
  await merchantPage.getByPlaceholder("البريد الإلكتروني").fill(merchant.email);
  await merchantPage.getByPlaceholder("كلمة المرور").fill(merchant.password);
  await merchantPage.getByRole("button", { name: "إنشاء حساب" }).click();
  await expectVisible(merchantPage.getByRole("button", { name: "تسجيل محل جديد" }), "merchant workspace");

  await merchantPage.getByRole("button", { name: "تسجيل محل جديد" }).click();
  await merchantPage.getByPlaceholder("اسم السوبر ماركت").fill(merchant.storeName);
  await merchantPage.getByPlaceholder("رقم الهاتف").fill("0550000003");
  await merchantPage.getByPlaceholder("البريد الإلكتروني (اسم المستخدم للدخول)").fill(merchant.email);
  await merchantPage.getByPlaceholder("كلمة المرور (4 أحرف على الأقل)").fill(merchant.password);
  await chooseFirstWilayaAndCommune(merchantPage);
  await merchantPage.getByRole("button", { name: "إرسال طلب التسجيل" }).click();
  await expectVisible(merchantPage.getByText(merchant.storeName), "new merchant store");
  await merchantPage.screenshot({ path: "/tmp/souq-ui-merchant.png", fullPage: true });

  // Sign out and use the rendered login flow to prove the persisted merchant role returns to its panel.
  await merchantPage.getByRole("button", { name: "خروج", exact: true }).first().click();
  await expectVisible(merchantPage.getByRole("button", { name: "دخول بالإيميل" }), "merchant signed out state");
  await signInThroughModal(merchantPage, { ...merchant, role: "merchant" });
  await expectVisible(merchantPage.getByText(merchant.storeName), "merchant login dashboard");
  await merchantContext.close();

  const courierContext = await browser.newContext();
  const courierPage = await courierContext.newPage();
  await courierPage.goto(baseUrl, { waitUntil: "networkidle" });

  // Courier: submit the complete two-stage public onboarding form.
  await courierPage.getByRole("button", { name: "انضم كموصل" }).click();
  const courierModal = courierPage
    .getByText("انضم كموصل — إعدادات التسجيل")
    .locator('xpath=ancestor::div[contains(@class, "fixed")][1]');
  await courierPage.getByPlaceholder("الاسم الكامل").fill(courier.name);
  await courierPage.getByPlaceholder("رقم الهاتف").fill("0550000004");
  await courierPage.getByPlaceholder("البريد الإلكتروني (اسم المستخدم للدخول)").fill(courier.email);
  await courierPage.getByPlaceholder("كلمة المرور (4 أحرف على الأقل)").fill(courier.password);
  await courierPage.getByRole("button", { name: "التالي: التواقيت ونطاق التغطية" }).click();
  await chooseFirstWilayaAndCommune(courierModal);
  await courierPage.getByRole("button", { name: /صباح/ }).click();
  await courierPage.getByRole("button", { name: "إرسال طلب الانضمام" }).click();
  try {
    await expectVisible(courierPage.getByText("حسابك قيد مراجعة المشرف"), "courier dashboard");
  } catch (error) {
    await courierPage.screenshot({ path: "/tmp/souq-ui-courier-failure.png", fullPage: true });
    const visibleText = (await courierPage.locator("body").innerText()).slice(-3000);
    throw new Error(`Courier onboarding did not reach its dashboard. Visible page text:\n${visibleText}\n${error}`);
  }
  await courierPage.screenshot({ path: "/tmp/souq-ui-courier.png", fullPage: true });

  // Sign out and confirm the email/password UI selects the courier role and restores its dashboard.
  await courierPage.getByRole("button", { name: "خروج", exact: true }).first().click();
  await expectVisible(courierPage.getByRole("button", { name: "دخول بالإيميل" }), "courier signed out state");
  await signInThroughModal(courierPage, { ...courier, role: "courier" });
  await expectVisible(courierPage.getByText("حسابك قيد مراجعة المشرف"), "courier login dashboard");
  await courierContext.close();

  console.log("PASS: browser UI registration, role-aware login, and merchant/courier dashboards succeeded.");
  console.log(`UI QA accounts: ${merchant.email} ; ${courier.email}`);
} finally {
  await browser.close();
}
