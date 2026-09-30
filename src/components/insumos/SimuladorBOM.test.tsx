import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SimuladorBOM } from "./SimuladorBOM";
import type { InsumoUI } from "@/hooks/useInsumos";

const item = (over: Partial<InsumoUI> & { id: string }): InsumoUI => ({
  nombre: over.id,
  categoria: "General",
  tipo: "caja_carton",
  stock: 0,
  minimo: 0,
  costo: 0,
  consumoDiario: 1,
  updatedAt: "2026-01-01",
  ...over,
});

const ITEMS: InsumoUI[] = [
  item({ id: "caja", nombre: "Caja cartón", tipo: "caja_carton", stock: 10000, costo: 10 }),
  item({ id: "tarima", nombre: "Tarima HT", tipo: "tarima", stock: 6, costo: 100 }),
  item({ id: "esq", nombre: "Esquinero", tipo: "esquinero", stock: 23, costo: 5 }),
  item({ id: "cera", nombre: "Cera", tipo: "cera", stock: 100, costo: 200 }),
];

describe("SimuladorBOM", () => {
  it("proyecta consumo y detecta el cuello de botella", () => {
    render(<SimuladorBOM items={ITEMS} />);

    // Default: 500 cajas export 18.14 → 10 tarimas necesarias.
    expect(screen.getByText("Tarimas HT")).toBeInTheDocument();
    // 6 tarimas → 324 cajas; 23 esquineros → 310: el tope es esquineros.
    expect(screen.getByText("310 cajas")).toBeInTheDocument();
    expect(screen.getByText("Cuello de botella")).toBeInTheDocument();
    // Grapas, PLU, SENASICA y papel no tienen bucket de stock.
    expect(screen.getAllByText("Sin control")).toHaveLength(4);
  });

  it("muestra costos de la corrida", () => {
    render(<SimuladorBOM items={ITEMS} />);
    expect(screen.getByText("Costo insumos")).toBeInTheDocument();
    expect(screen.getByText("Por caja")).toBeInTheDocument();
    expect(screen.getByText("Por kilo")).toBeInTheDocument();
  });
});
