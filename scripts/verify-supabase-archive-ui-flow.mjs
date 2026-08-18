import { chromium } from "@playwright/test";

const baseUrl = process.env.E2E_BASE_URL || "http://127.0.0.1:3000";
const runId = Date.now();
const merchant = {
  email: "ui.merchant.1787000381467@example.invalid",
  password: "UiMerchant-1787000381467-Test",
  storeName: "UI Merchant 1787000381467",
};
const customer = {
  email: `ui.archive.customer.${runId}@example.invalid`,
  password: `UiArchiveCustomer-${runId}-Test`,
};
const product = { name: `منتج أرشفة حساسة Supabase ${runId}`, price: "5001" };

async function expectVisible(locator, label) {
  await locator.waitFor({ state: "visible", timeout: 20_000 });
  if (!(await locator.isVisible())) throw new Error(`Expected visible: ${label}`);
}

async function signIn(page, { email, password, role = "merchant" }) {
  await page.getByRole("button", { name: "دخول بالإيميل" }).click();
  const modal = page.locator("div.fixed").last();
  if (role === "customer") await modal.getByRole("button", { name: "عميل", exact: true }).click();
  await modal.getByPlaceholder("البريد الإلكتروني").fill(email);
  await modal.getByPlaceholder("كلمة المرور").fill(password);
  await modal.getByRole("button", { name: "تسجيل الدخول" }).click();
}

const browser = await chromium.launch({ headless: true });
const errors = [];
try {
  const merchantContext = await browser.newContext();
  const merchantPage = await merchantContext.newPage();
  merchantPage.on("pageerror", (error) => errors.push(error.message));
  await merchantPage.goto(baseUrl, { waitUntil: "networkidle" });
  await signIn(merchantPage, merchant);
  await expectVisible(merchantPage.getByText(merchant.storeName, { exact: true }), "merchant dashboard");
  await merchantPage.getByPlaceholder("اسم المنتج").fill(product.name);
  await merchantPage.getByPlaceholder("السعر").fill(product.price);
  await merchantPage.getByRole("button", { name: "إضافة", exact: true }).click();
  await expectVisible(merchantPage.getByText(product.name, { exact: true }), "persisted QA product");
  await merchantPage.getByRole("button", { name: "خروج", exact: true }).first().click();
  await merchantContext.close();

  const customerContext = await browser.newContext();
  const customerPage = await customerContext.newPage();
  customerPage.on("pageerror", (error) => errors.push(error.message));
  await customerPage.goto(baseUrl, { waitUntil: "networkidle" });
  await customerPage.getByRole("button", { name: "دخول بالإيميل" }).click();
  const customerModal = customerPage.locator("div.fixed").last();
  await customerModal.getByRole("button", { name: "عميل", exact: true }).click();
  await customerModal.getByRole("button", { name: "حساب جديد" }).click();
  await customerModal.getByPlaceholder("البريد الإلكتروني").fill(customer.email);
  await customerModal.getByPlaceholder("كلمة المرور").fill(customer.password);
  await customerModal.getByRole("button", { name: "إنشاء حساب" }).click();
  await expectVisible(customerPage.getByText(merchant.storeName, { exact: true }), "approved store catalog entry");
  await customerPage.getByText(merchant.storeName, { exact: true }).click();
  await expectVisible(customerPage.getByText(product.name, { exact: true }), "QA product catalog entry");
  const productCard = customerPage.getByText(product.name, { exact: true }).locator("xpath=ancestor::div[contains(@class, 'rounded-2xl')][1]");
  await productCard.getByRole("button").click();
  await customerPage.getByRole("button", { name: /السلة/ }).click();
  const cartDrawer = customerPage.locator("div.fixed").last();
  await cartDrawer.getByRole("button", { name: "تأكيد الطلب (دفع نقدي)" }).click();
  await expectVisible(customerPage.getByRole("button", { name: "طلباتي" }), "customer order confirmation");
  try {
    await customerPage.waitForFunction((productName) => document.body.innerText.includes(productName), product.name, { timeout: 20_000 });
  } catch (error) {
    const visibleText = (await customerPage.locator("body").innerText()).slice(-4000);
    throw new Error(`Customer order was not rendered before archiving. Visible page text:\n${visibleText}\n${error}`);
  }
  await customerContext.close();

  const archiveContext = await browser.newContext();
  const archivePage = await archiveContext.newPage();
  archivePage.on("pageerror", (error) => errors.push(error.message));
  await archivePage.goto(baseUrl, { waitUntil: "networkidle" });
  await signIn(archivePage, merchant);
  await archivePage.getByRole("button", { name: /الطلبات الواردة/ }).click();
  await expectVisible(archivePage.getByText(product.name, { exact: false }).last(), "merchant order before archive");
  const orderCard = archivePage.getByText(product.name, { exact: false }).last().locator("xpath=ancestor::div[contains(@class, 'rounded-2xl')][1]");
  await orderCard.getByRole("button", { name: "حذف من قائمتي", exact: true }).click();
  await expectVisible(archivePage.getByText("أُخفي الطلب من قائمتك فقط؛ يبقى محفوظاً في أرشيف الإدارة.", { exact: true }), "personal archive notice");
  await orderCard.waitFor({ state: "detached", timeout: 20_000 });
  await archivePage.screenshot({ path: "/tmp/souq-archive-ui-flow.png", fullPage: true });
  await archiveContext.close();

  if (errors.length) throw new Error(`Browser runtime errors:\n${errors.join("\n")}`);
  console.log("PASS: Merchant archived its order; the order disappeared only from its own UI.");
  console.log(`QA product: ${product.name}`);
  console.log(`QA customer: ${customer.email}`);
} finally {
  await browser.close();
}
