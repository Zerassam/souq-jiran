import { chromium } from "@playwright/test";

const baseUrl = process.env.E2E_BASE_URL || "http://127.0.0.1:3000";
const runId = Date.now();
const merchant = {
  email: "ui.merchant.1787000381467@example.invalid",
  password: "UiMerchant-1787000381467-Test",
  storeName: "UI Merchant 1787000381467",
};
const customer = {
  email: `ui.customer.${runId}@example.invalid`,
  password: `UiCustomer-${runId}-Test`,
};
const product = {
  name: `منتج تحقق Supabase ${runId}`,
  price: "100",
};

async function expectVisible(locator, label) {
  await locator.waitFor({ state: "visible", timeout: 20_000 });
  if (!(await locator.isVisible())) throw new Error(`Expected visible: ${label}`);
}

function recordBrowserErrors(page, errors) {
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
}

async function signInThroughModal(page, { email, password, role = "merchant" }) {
  await page.getByRole("button", { name: "دخول بالإيميل" }).click();
  const authModal = page.locator("div.fixed").last();
  if (role === "customer") await authModal.getByRole("button", { name: "عميل", exact: true }).click();
  if (role === "courier") await authModal.getByRole("button", { name: "موصّل", exact: true }).click();
  await authModal.getByPlaceholder("البريد الإلكتروني").fill(email);
  await authModal.getByPlaceholder("كلمة المرور").fill(password);
  await authModal.getByRole("button", { name: "تسجيل الدخول" }).click();
}

const browser = await chromium.launch({ headless: true });
const errors = [];
try {
  const merchantContext = await browser.newContext();
  const merchantPage = await merchantContext.newPage();
  recordBrowserErrors(merchantPage, errors);
  await merchantPage.goto(baseUrl, { waitUntil: "networkidle" });

  // An approved merchant creates a product from its own products panel.
  await signInThroughModal(merchantPage, merchant);
  await expectVisible(merchantPage.getByText(merchant.storeName, { exact: true }), "approved merchant dashboard");
  await merchantPage.getByPlaceholder("اسم المنتج").fill(product.name);
  await merchantPage.getByPlaceholder("السعر").fill(product.price);
  await merchantPage.getByRole("button", { name: "إضافة", exact: true }).click();
  await expectVisible(merchantPage.getByText(product.name, { exact: true }), "newly persisted product");
  await merchantPage.getByRole("button", { name: "خروج", exact: true }).first().click();
  await expectVisible(merchantPage.getByRole("button", { name: "دخول بالإيميل" }), "merchant signed out state");
  await merchantContext.close();

  const customerContext = await browser.newContext();
  const customerPage = await customerContext.newPage();
  recordBrowserErrors(customerPage, errors);
  await customerPage.goto(baseUrl, { waitUntil: "networkidle" });

  // A fresh customer registers through the UI, sees the approved store and submits a cash order.
  await customerPage.getByRole("button", { name: "دخول بالإيميل" }).click();
  const authModal = customerPage.locator("div.fixed").last();
  await authModal.getByRole("button", { name: "عميل", exact: true }).click();
  await authModal.getByRole("button", { name: "حساب جديد" }).click();
  await authModal.getByPlaceholder("البريد الإلكتروني").fill(customer.email);
  await authModal.getByPlaceholder("كلمة المرور").fill(customer.password);
  await authModal.getByRole("button", { name: "إنشاء حساب" }).click();

  await expectVisible(customerPage.getByText(merchant.storeName, { exact: true }), "approved store in customer catalog");
  await customerPage.getByText(merchant.storeName, { exact: true }).click();
  await expectVisible(customerPage.getByText(product.name, { exact: true }), "product in customer storefront");
  const productCard = customerPage
    .getByText(product.name, { exact: true })
    .locator("xpath=ancestor::div[contains(@class, 'rounded-2xl')][1]");
  await productCard.getByRole("button").click();
  await customerPage.getByRole("button", { name: /السلة/ }).click();
  const cartDrawer = customerPage.locator("div.fixed").last();
  await expectVisible(cartDrawer.getByText(product.name, { exact: true }), "product in customer cart");
  await cartDrawer.getByRole("button", { name: "تأكيد الطلب (دفع نقدي)" }).click();
  await expectVisible(customerPage.getByRole("button", { name: "طلباتي" }), "customer orders tab");
  try {
    await customerPage.waitForFunction((productName) => document.body.innerText.includes(productName), product.name, { timeout: 20_000 });
  } catch (error) {
    await customerPage.screenshot({ path: "/tmp/souq-commerce-order-failure.png", fullPage: true });
    const visibleText = (await customerPage.locator("body").innerText()).slice(-4000);
    throw new Error(`Customer order was not rendered. Visible page text:\n${visibleText}\nBrowser errors:\n${errors.join("\n")}\n${error}`);
  }
  await customerContext.close();

  const returnMerchantContext = await browser.newContext();
  const returnMerchantPage = await returnMerchantContext.newPage();
  recordBrowserErrors(returnMerchantPage, errors);
  await returnMerchantPage.goto(baseUrl, { waitUntil: "networkidle" });
  await signInThroughModal(returnMerchantPage, merchant);
  await expectVisible(returnMerchantPage.getByText(merchant.storeName, { exact: true }), "merchant dashboard after order");
  await returnMerchantPage.getByRole("button", { name: /الطلبات الواردة/ }).click();
  try {
    await returnMerchantPage.waitForFunction((productName) => document.body.innerText.includes(productName), product.name, { timeout: 20_000 });
  } catch (error) {
    await returnMerchantPage.screenshot({ path: "/tmp/souq-commerce-merchant-order-failure.png", fullPage: true });
    const visibleText = (await returnMerchantPage.locator("body").innerText()).slice(-4000);
    throw new Error(`Merchant order was not rendered. Visible page text:\n${visibleText}\nBrowser errors:\n${errors.join("\n")}\n${error}`);
  }
  const orderCard = returnMerchantPage
    .getByText(product.name, { exact: false })
    .last()
    .locator("xpath=ancestor::div[contains(@class, 'rounded-2xl')][1]");
  await orderCard.getByRole("button", { name: "قبول", exact: true }).click();
  await expectVisible(orderCard.getByText("تم القبول", { exact: true }), "accepted order status");
  await returnMerchantPage.screenshot({ path: "/tmp/souq-commerce-ui-flow.png", fullPage: true });
  await returnMerchantContext.close();

  if (errors.length > 0) throw new Error(`Browser runtime errors:\n${errors.join("\n")}`);
  console.log("PASS: Supabase product creation, customer ordering, and merchant acceptance succeeded.");
  console.log(`QA product: ${product.name}`);
  console.log(`QA customer: ${customer.email}`);
} finally {
  await browser.close();
}
