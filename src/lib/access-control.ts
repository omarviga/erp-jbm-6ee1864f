import { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Administrador (admin_owner)",
  produccion: "Produccion",
  finanzas: "Finanzas",
  ventas: "Operador CDMX",
  almacen: "Bascula / Almacen / Logistica",
};

export const canAccessByRoles = (
  allowedRoles: AppRole[] | undefined,
  isAdmin: boolean,
  hasRole: (role: AppRole) => boolean,
) => {
  if (!allowedRoles || allowedRoles.length === 0) {
    return true;
  }

  if (isAdmin) {
    return true;
  }

  return allowedRoles.some((role) => hasRole(role));
};
