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
  });

  it("uses Supabase Auth instead of a browser-stored password lookup", () => {
    const appSource = readFileSync(resolve(projectRoot, "client/src/pages/SouqJiranApp.jsx"), "utf8");

    expect(appSource).toContain("supabase.auth.signInWithPassword");
    expect(appSource).toContain("supabase.auth.signUp");
    expect(appSource).toContain("supabase.auth.onAuthStateChange");
    expect(appSource).not.toContain("STORAGE.auth");
    expect(appSource).not.toContain("STORAGE.accounts");
  });
});
