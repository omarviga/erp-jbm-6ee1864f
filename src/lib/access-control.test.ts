import { describe, expect, it } from "vitest";

import { Constants } from "@/integrations/supabase/types";
import { AppRole, canAccessByRoles, ROLE_LABELS } from "./access-control";

const ROLES_ENUM = Constants.public.Enums.app_role;

describe("ROLE_LABELS", () => {
  it("cubre exactamente los valores del enum app_role (sin deriva)", () => {
    expect(Object.keys(ROLE_LABELS).sort()).toEqual([...ROLES_ENUM].sort());
  });

  it("tiene etiqueta no vacía para cada rol", () => {
    for (const rol of ROLES_ENUM) {
      expect(ROLE_LABELS[rol as AppRole].trim().length).toBeGreaterThan(0);
    }
  });

  it("incluye campo como rol reservado documentado", () => {
    expect(ROLES_ENUM).toContain("campo");
    expect(ROLE_LABELS.campo).toMatch(/campo/i);
  });
});

describe("canAccessByRoles", () => {
  const hasRole = (roles: AppRole[]) => (role: AppRole) => roles.includes(role);

  it("permite cuando no hay restricción de roles", () => {
    expect(canAccessByRoles(undefined, false, hasRole([]))).toBe(true);
    expect(canAccessByRoles([], false, hasRole([]))).toBe(true);
  });

  it("admin entra a todo aunque no liste su rol", () => {
    expect(canAccessByRoles(["finanzas"], true, hasRole([]))).toBe(true);
  });

  it("permite con al menos un rol coincidente", () => {
    expect(canAccessByRoles(["ventas", "almacen"], false, hasRole(["almacen"]))).toBe(true);
  });

  it("niega sin coincidencias", () => {
    expect(canAccessByRoles(["finanzas"], false, hasRole(["ventas"]))).toBe(false);
    expect(canAccessByRoles(["finanzas"], false, hasRole([]))).toBe(false);
  });
});
