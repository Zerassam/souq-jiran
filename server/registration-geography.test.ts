import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "..");

describe("تسجيل الحساب ونطاقات التغطية", () => {
  const appSource = readFileSync(resolve(projectRoot, "client/src/pages/SouqJiranApp.jsx"), "utf8");
  const migration = readFileSync(resolve(projectRoot, "supabase/migrations/20260902_registration_geography_scopes.sql"), "utf8");
  const communeData = readFileSync(resolve(projectRoot, "client/src/data/algeriaCommunes.js"), "utf8");

  it("يفصل البريد والهاتف ويعتمد خطوة انتقال وحيدة قبل إرسال طلب الانضمام", () => {
    expect(appSource).toContain('type="email" autoComplete="email" data-testid="merchant-email-input"');
    expect(appSource).toContain('placeholder="رقم الهاتف للتواصل (05/06/07)"');
    expect(appSource).toContain("التالي: بيانات المحل");
    expect(appSource).toContain("التالي: بيانات الموصل");
    expect(appSource).toContain("إرسال طلب الانضمام");
    expect(appSource).toContain('openAdminContactLink("membership_request"');
  });

  it("يعالج استعادة الحساب بإعادة إرسال بريد OTP آمن من Supabase", () => {
    expect(appSource).toContain("options: { shouldCreateUser: false }");
    expect(appSource).toContain("أُرسل رمز دخول جديد إليه");
    expect(appSource).not.toContain("supabase.auth.resetPasswordForEmail");
    expect(appSource).not.toContain('openAdminContactLink("account_recovery"');
    expect(appSource).toContain("استعادة الحساب");
  });

  it("يوفر تغطية وطنية وولايات وبلديات كاملة قابلة للبحث والنقر", () => {
    expect(appSource).toContain("تغطية كامل التراب الوطني (58 ولاية)");
    expect(appSource).toContain("تحديد كافة البلديات");
    expect(appSource).toContain("بحث داخل البلديات");
    expect(appSource).toContain("nationwideCoverage");
    expect(communeData).toContain("FULL_COMMUNES_BY_WILAYA");
    expect(communeData).toContain("ميلة");
    const milaBlock = communeData.match(/"ميلة": \[(.*?)\n  \]/s)?.[1] ?? "";
    expect((milaBlock.match(/"/g) ?? []).length / 2).toBe(32);
  });

  it("يخزن نطاقات الموصل الثلاثة والولايات المجاورة دون قبول قيمة عشوائية", () => {
    expect(appSource).toContain("local");
    expect(appSource).toContain("wilaya");
    expect(appSource).toContain("inter_wilaya");
    expect(appSource).toContain("adjacentWilayas");
    expect(migration).toContain("delivery_wilayas text[]");
    expect(migration).toContain("nationwide_coverage boolean");
    expect(migration).toContain("adjacent_wilayas text[]");
    expect(migration).toContain("coverage_level in ('local', 'wilaya', 'inter_wilaya')");
  });
});
