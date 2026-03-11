export const COMPANY_INFO = {
  displayName: "JBM Cítricos Premium",
  legalName: "Limones Barragán S.A. de C.V.",
  addressLine1: "Carretera Federal Cuatro Caminos-Apatzingan Km 16, No 10. Antúnez, Michoacán",
  addressLine2: "",
  phone: "+52 (425) 115 2205",
  supportEmail: "soporte@jbm.com.mx",
} as const;

export const COMPANY_ADDRESS = [COMPANY_INFO.addressLine1, COMPANY_INFO.addressLine2]
  .filter(Boolean)
  .join(". ");
