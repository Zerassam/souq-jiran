import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "..");

describe("provider vehicles and optional media", () => {
  it("offers a selectable set of four vehicle types and preserves a multi-vehicle courier model", () => {
    const appSource = readFileSync(resolve(projectRoot, "client/src/pages/SouqJiranApp.jsx"), "utf8");

    expect(appSource).toContain("const VEHICLE_OPTIONS = [");
    expect(appSource).toContain('id: "bicycle"');
    expect(appSource).toContain('id: "motorcycle"');
    expect(appSource).toContain('id: "car"');
    expect(appSource).toContain('id: "truck"');
    expect(appSource).toContain("function normalizeCourierVehicles(value)");
    expect(appSource).toContain("vehicles: vehicleIds");
    expect(appSource).toContain('data-testid="courier-vehicles-tab"');
  });

  it("keeps store images limited and documents explicitly optional without claiming their approval", () => {
    const appSource = readFileSync(resolve(projectRoot, "client/src/pages/SouqJiranApp.jsx"), "utf8");

    expect(appSource).toContain("const MAX_STORE_PHOTOS = 3;");
    expect(appSource).toContain("يمكنك إدراج ثلاث صور للمتجر كحد أقصى.");
    expect(appSource).toContain("إكمال الوثائق — اختياري الآن");
    expect(appSource).toContain("لا تعني مراجعة أو تصديقاً أو تأكيداً بأن المنصة استلمت وثائق رسمية");
    expect(appSource).toContain("لا نطلب وثيقة ملكية لها في هذه المرحلة");
    expect(appSource).toContain('data-testid="merchant-media-tab"');
  });

  it("defines a private RLS-backed media store and server-side three-photo cap", () => {
    const migration = readFileSync(resolve(projectRoot, "supabase/migrations/20260904_provider_media_and_multi_vehicle.sql"), "utf8");

    expect(migration).toContain("add column if not exists vehicles text[]");
    expect(migration).toContain("create table if not exists public.provider_media");
    expect(migration).toContain("alter table public.provider_media enable row level security");
    expect(migration).toContain("STORE_PHOTO_LIMIT_REACHED");
    expect(migration).toContain("'provider-media', 'provider-media', false");
    expect(migration).toContain("provider_media_object_read");
    expect(migration).toContain("public.is_app_admin()");
  });
});
