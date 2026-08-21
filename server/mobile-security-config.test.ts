import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "..");
const readProjectFile = (relativePath: string) => readFileSync(resolve(projectRoot, relativePath), "utf8");

describe("إعدادات إصدار Android الآمن", () => {
  it("يفعّل R8 وتصغير الموارد ويعطّل النسخ الاحتياطي والاتصالات الصريحة", () => {
    const gradle = readProjectFile("android/app/build.gradle");
    const manifest = readProjectFile("android/app/src/main/AndroidManifest.xml");

    expect(gradle).toContain("minifyEnabled true");
    expect(gradle).toContain("shrinkResources true");
    expect(gradle).toContain("debuggable false");
    expect(manifest).toContain('android:allowBackup="false"');
    expect(manifest).toContain('android:usesCleartextTraffic="false"');
  });

  it("يحافظ على نقاط ربط Capacitor الضرورية عند تشغيل R8", () => {
    const proguard = readProjectFile("android/app/proguard-rules.pro");

    expect(proguard).toContain("-keep class com.getcapacitor.** { *; }");
    expect(proguard).toContain("@com.getcapacitor.annotation.CapacitorPlugin");
    expect(proguard).toContain("@android.webkit.JavascriptInterface <methods>");
    expect(proguard).toContain("-dontwarn com.facebook.login.LoginManager");
  });
});

describe("حماية مسار إشعارات الطلبات في Supabase", () => {
  it("يفعّل RLS ولا يمنح دوال Vault أو الـ Trigger للعامة", () => {
    const migration = readProjectFile("supabase/migrations/20260901_order_push_notifications.sql");

    expect(migration).toContain("alter table public.order_push_events enable row level security");
    expect(migration).toContain("order_push_events_admin_read");
    expect(migration).toContain("revoke all on function public.queue_order_push_event");
    expect(migration).toContain("revoke all on function public.dispatch_order_status_push");
    expect(migration).toContain("vault.decrypted_secrets");
  });
});
