import { afterEach, describe, expect, it } from "vitest";

import {
  CLAVE_SONIDO,
  CLAVE_UMBRAL,
  contarBajoUmbral,
  emitirChime,
  evaluarUmbral,
  guardarSonidoActivado,
  guardarUmbralGlobal,
  idsBajoUmbral,
  leerSonidoActivado,
  leerUmbralGlobal,
  UMBRAL_DEFECTO,
} from "./alertas";

afterEach(() => {
  localStorage.clear();
});

describe("evaluarUmbral", () => {
  it("detecta el faltante con déficit y porcentaje", () => {
    expect(evaluarUmbral(4, 10)).toEqual({ bajoUmbral: true, deficit: 6, pctFaltante: 60 });
  });

  it("está en nivel cuando alcanza o supera el umbral", () => {
    expect(evaluarUmbral(10, 10).bajoUmbral).toBe(false);
    expect(evaluarUmbral(120, 10)).toEqual({ bajoUmbral: false, deficit: 0, pctFaltante: 0 });
  });

  it("nunca marca crítico con umbral en cero", () => {
    expect(evaluarUmbral(0, 0).bajoUmbral).toBe(false);
  });

  it("tolera valores inválidos sin romper", () => {
    expect(evaluarUmbral(Number.NaN, 10).bajoUmbral).toBe(true);
    expect(evaluarUmbral(5, Number.NaN).bajoUmbral).toBe(false);
  });
});

describe("idsBajoUmbral / contarBajoUmbral", () => {
  it("lista solo las partidas en riesgo", () => {
    const items = [
      { id: "a", cajas: 4 },
      { id: "b", cajas: 10 },
      { id: "c", cajas: 120 },
    ];

    expect(idsBajoUmbral(items, 10)).toEqual(["a"]);
    expect(contarBajoUmbral(items, 10)).toBe(1);
    expect(contarBajoUmbral([], 10)).toBe(0);
  });
});

describe("persistencia local", () => {
  it("usa 10 cajas por defecto y respeta lo guardado", () => {
    expect(leerUmbralGlobal()).toBe(UMBRAL_DEFECTO);

    guardarUmbralGlobal(25);
    expect(leerUmbralGlobal()).toBe(25);
  });

  it("ignora valores corruptos del almacenamiento", () => {
    localStorage.setItem(CLAVE_UMBRAL, "roto");
    expect(leerUmbralGlobal()).toBe(UMBRAL_DEFECTO);
  });

  it("el sonido viene activado y persiste la preferencia", () => {
    expect(leerSonidoActivado()).toBe(true);

    guardarSonidoActivado(false);
    expect(leerSonidoActivado()).toBe(false);
    expect(localStorage.getItem(CLAVE_SONIDO)).toBe("0");
  });
});

describe("emitirChime", () => {
  it("no revienta sin Web Audio (jsdom) y reporta que no sonó", () => {
    expect(emitirChime()).toBe(false);
  });
});
