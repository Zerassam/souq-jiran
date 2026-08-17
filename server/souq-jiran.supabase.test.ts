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
});
