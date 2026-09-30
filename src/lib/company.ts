export interface DatosFiscalesEmpresa {
  displayName: string;
  legalName: string;
  addressLine1: string;
  addressLine2: string;
  phone: string;
  supportEmail: string;
  /** RFC fiscal. Se imprime en el ticket solo cuando está configurado. */
  rfc: string;
  /** Registro fitosanitario SENASICA de la báscula. */
  registroSenasica: string;
  /** Domicilio de la báscula cuando difiere del corporativo. */
  direccionBascula: string;
  /** Nota legal de movilización al pie del ticket térmico. */
  notaMovilizacion: string;
}

export const COMPANY_INFO: DatosFiscalesEmpresa = {
  displayName: "JBM Cítricos Premium",
  legalName: "Limones Barragán S.A. de C.V.",
  addressLine1: "Carretera Federal Cuatro Caminos-Apatzingan Km 16, No 10",
  addressLine2: "Antúnez, Michoacán",
  phone: "+52 (425) 115 2205",
  supportEmail: "soporte@jbm.com.mx",
  rfc: "",
  registroSenasica: "",
  direccionBascula: "",
  notaMovilizacion:
    "Este comprobante ampara la recepción de fruta en báscula y no es un comprobante fiscal. Conserve su boleta para la liquidación.",
};

export const COMPANY_ADDRESS = `${COMPANY_INFO.addressLine1}. ${COMPANY_INFO.addressLine2}`;
