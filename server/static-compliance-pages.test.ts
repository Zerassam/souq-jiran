import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readPage = (name: string) =>
  readFileSync(resolve(process.cwd(), "docs", name), "utf8");

describe("صفحات الامتثال الثابتة", () => {
  it("توفّر سياسة خصوصية مرتبطة بصفحات الامتثال الأخرى", () => {
    const page = readPage("souqjiran-privacy.html");
    expect(page).toContain('lang="ar"');
    expect(page).toContain("souqjiran-terms.html");
    expect(page).toContain("souqjiran-delete-account.html");
    expect(page).toContain("Firebase Cloud Messaging");
  });

  it("توفّر شروط الخدمة وإحالات سياسة الخصوصية وحذف الحساب", () => {
    const page = readPage("souqjiran-terms.html");
    expect(page).toContain("شروط الخدمة");
    expect(page).toContain("souqjiran-privacy.html");
    expect(page).toContain("souqjiran-delete-account.html");
  });

  it("يمنع نموذج الحذف إدخال الأسرار ويُنشئ رسالة طلب مراجعة", () => {
    const page = readPage("souqjiran-delete-account.html");
    expect(page).toContain("لا ترسل كلمة المرور أو رمز SMS");
    expect(page).toContain("mailto:listportail@gmail.com");
    expect(page).toContain("form.checkValidity()");
    expect(page).toContain("طلب حذف حساب - سوق الجيران");
  });
});
