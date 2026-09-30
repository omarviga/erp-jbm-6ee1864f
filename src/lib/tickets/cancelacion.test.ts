import { describe, expect, it } from "vitest";
import {
  esNotaCancelacionSinPagos,
  validarMotivoCancelacion,
} from "./cancelacion";

describe("validarMotivoCancelacion", () => {
  it("rechaza motivo vacío o demasiado corto", () => {
    expect(validarMotivoCancelacion("")).toHaveLength(1);
    expect(validarMotivoCancelacion("  abc ")).toHaveLength(1);
  });

  it("acepta motivo suficiente", () => {
    expect(validarMotivoCancelacion("Ticket duplicado")).toEqual([]);
  });
});

describe("esNotaCancelacionSinPagos", () => {
  it("solo permite cancelar sin pagos aplicados", () => {
    expect(esNotaCancelacionSinPagos(0)).toBe(true);
    expect(esNotaCancelacionSinPagos(0.009)).toBe(true);
    expect(esNotaCancelacionSinPagos(0.01)).toBe(false);
    expect(esNotaCancelacionSinPagos(500)).toBe(false);
  });
});
