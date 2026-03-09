import { render, screen, fireEvent } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { vi } from "vitest";

import BodegaCDMX from "./BodegaCDMX";

const navigateMock = vi.fn();
const signOutMock = vi.fn();

vi.mock("react-router-dom", () => ({
  useNavigate: () => navigateMock,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { email: "operador@jbm.com" },
    isAdmin: true,
    signOut: signOutMock,
  }),
}));

vi.mock("./BodegaCDMX/POSTab", () => ({ default: () => <div>POS TAB CONTENT</div> }));
vi.mock("./BodegaCDMX/RecepcionesTab", () => ({ default: () => <div>RECEPCIONES TAB CONTENT</div> }));
vi.mock("./BodegaCDMX/InventarioTab", () => ({ default: () => <div>INVENTARIO TAB CONTENT</div> }));
vi.mock("./BodegaCDMX/CorteCajaTab", () => ({ default: () => <div>CORTE TAB CONTENT</div> }));
vi.mock("./BodegaCDMX/GastosTab", () => ({ default: () => <div>GASTOS TAB CONTENT</div> }));
vi.mock("./BodegaCDMX/DashboardTab", () => ({ default: () => <div>DASHBOARD TAB CONTENT</div> }));

const renderPage = () => render(<TooltipProvider><BodegaCDMX /></TooltipProvider>);

describe("Bodega CDMX flow", () => {
  it("permite navegar entre submódulos y mostrar contenido correspondiente", () => {
    renderPage();

    expect(screen.getByText("POS TAB CONTENT")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Recepciones/i }));
    expect(screen.getByText("RECEPCIONES TAB CONTENT")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Inventario/i }));
    expect(screen.getByText("INVENTARIO TAB CONTENT")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Corte de Caja/i }));
    expect(screen.getByText("CORTE TAB CONTENT")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Gastos Locales/i }));
    expect(screen.getByText("GASTOS TAB CONTENT")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Rentabilidad/i }));
    expect(screen.getByText("DASHBOARD TAB CONTENT")).toBeInTheDocument();
  });

  it("permite al admin volver al ERP principal", () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /Volver al ERP/i }));
    expect(navigateMock).toHaveBeenCalledWith("/");
  });
});
