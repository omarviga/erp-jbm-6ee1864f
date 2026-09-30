import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CancelarTicketModal } from "./CancelarTicketModal";

describe("CancelarTicketModal", () => {
  it("no renderiza cerrado", () => {
    render(
      <CancelarTicketModal open={false} folio="L-1" onConfirm={() => {}} onBack={() => {}} />,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("exige motivo antes de confirmar", () => {
    const onConfirm = vi.fn();
    render(
      <CancelarTicketModal open folio="L-0001" onConfirm={onConfirm} onBack={() => {}} />,
    );
    const boton = screen.getByRole("button", { name: /confirmar cancelación/i });
    expect(boton).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/motivo de cancelación/i), {
      target: { value: "abc" },
    });
    expect(boton).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/motivo de cancelación/i), {
      target: { value: "Ticket duplicado por error" },
    });
    expect(boton).not.toBeDisabled();
    fireEvent.click(boton);
    expect(onConfirm).toHaveBeenCalledWith("Ticket duplicado por error");
  });
});
