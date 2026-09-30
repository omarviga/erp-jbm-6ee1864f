import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("supabase client", () => {
  it("carga cuando las variables existen", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://xyz.supabase.co");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "clave-publica");

    const modulo = await import("./client");

    expect(modulo.supabase).toBeDefined();
  });

  it("falla con mensaje accionable cuando falta la URL", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "clave-publica");

    await expect(import("./client")).rejects.toThrow(/VITE_SUPABASE_URL/);
  });

  it("acepta la anon key legacy cuando no hay publishable key", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://xyz.supabase.co");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "clave-anon");

    const modulo = await import("./client");

    expect(modulo.supabase).toBeDefined();
  });

  it("menciona ambas claves cuando faltan las dos", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://xyz.supabase.co");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");

    await expect(import("./client")).rejects.toThrow(
      /VITE_SUPABASE_PUBLISHABLE_KEY.*VITE_SUPABASE_ANON_KEY/
    );
  });
});
