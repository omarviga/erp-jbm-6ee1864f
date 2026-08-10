/* eslint-disable react-refresh/only-export-components */
import type React from "react";
import { vi } from "vitest";

export const mockCardComponents = {
  Card: ({ children }: { children: React.ReactNode }) => <section>{children}</section>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <header>{children}</header>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
};

export const MockButton = ({
  children,
  onClick,
  disabled,
  type,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
}) => (
  <button type={type || "button"} onClick={onClick} disabled={disabled}>
    {children}
  </button>
);

export const MockInput = ({
  value,
  onChange,
  id,
  type,
  placeholder,
  className,
}: {
  value?: string | number;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  id?: string;
  type?: string;
  placeholder?: string;
  className?: string;
}) => (
  <input
    id={id}
    type={type}
    value={value}
    onChange={onChange}
    placeholder={placeholder}
    className={className}
  />
);

export const MockTextarea = ({
  value,
  onChange,
  placeholder,
}: {
  value?: string;
  onChange?: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
}) => <textarea value={value} onChange={onChange} placeholder={placeholder} />;

export const MockLabel = ({
  children,
  htmlFor,
  className,
}: {
  children: React.ReactNode;
  htmlFor?: string;
  className?: string;
}) => (
  <label htmlFor={htmlFor} className={className}>
    {children}
  </label>
);

export const MockBadge = ({ children }: { children: React.ReactNode }) => <span>{children}</span>;

export const mockTableComponents = {
  Table: ({ children }: { children: React.ReactNode }) => <table><tbody>{children}</tbody></table>,
  TableBody: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TableCell: ({ children }: { children: React.ReactNode }) => <td>{children}</td>,
  TableHead: ({ children }: { children: React.ReactNode }) => <th>{children}</th>,
  TableHeader: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TableRow: ({ children }: { children: React.ReactNode }) => <tr>{children}</tr>,
};

export const mockDialogComponents = {
  Dialog: ({
    open,
    children,
  }: {
    open: boolean;
    children: React.ReactNode;
  }) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h3>{children}</h3>,
};

export const mockSelectComponents = {
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value: string;
    onValueChange: (value: string) => void;
    children: React.ReactNode;
  }) => (
    <select
      aria-label="Metodo de pago"
      value={value}
      onChange={(event) => onValueChange(event.target.value)}
    >
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => (
    <option value="">{placeholder || ""}</option>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({
    value,
    children,
  }: {
    value: string;
    children: React.ReactNode;
  }) => <option value={value}>{children}</option>,
};

export const createUseQueryResult = (
  data: unknown,
  overrides?: Partial<{ refetch: () => Promise<void> }>,
) => ({
  data,
  isLoading: false,
  refetch: overrides?.refetch || vi.fn().mockResolvedValue(undefined),
});

export const createTransferenciaEnTransito = (overrides?: Partial<{
  id: string;
  folio: string;
  estado: string;
  fecha_salida: string;
  fecha_recepcion: string | null;
  chofer: string;
  placas: string;
  notas_salida: string;
}>) => ({
  id: "tr-1",
  folio: "TR-001",
  estado: "en_transito",
  fecha_salida: "2026-03-13T08:00:00.000Z",
  fecha_recepcion: null,
  chofer: "Luis",
  placas: "ABC123",
  notas_salida: "Salida normal",
  ...overrides,
});

export const createDetalleTransferencia = (overrides?: Partial<{
  id: string;
  presentacion_id: string;
  cantidad_enviada: number;
  cantidad_recibida: number;
  diferencia: number;
  precio_base: number;
  precio_venta: number;
  notas_diferencia: string | null;
  presentacion: {
    nombre: string;
    peso_kg: number;
    tipo: string;
  };
}>) => ({
  id: "det-1",
  presentacion_id: "pres-1",
  cantidad_enviada: 10,
  cantidad_recibida: 10,
  diferencia: 0,
  precio_base: 100,
  precio_venta: 155,
  notas_diferencia: null,
  presentacion: {
    nombre: "Limon 18 kg",
    peso_kg: 18,
    tipo: "exportacion",
  },
  ...overrides,
});

export const createInventarioItem = (overrides?: Partial<{
  id: string;
  presentacion_id: string;
  cantidad_disponible: number;
  precio_base?: number;
  precio_venta: number;
  fecha_ingreso: string;
  presentacion: {
    nombre: string;
    tipo: string;
    peso_kg: number;
  };
}>) => ({
  id: "inv-1",
  presentacion_id: "pres-1",
  cantidad_disponible: 5,
  precio_venta: 160,
  fecha_ingreso: "2026-03-13T08:00:00.000Z",
  presentacion: {
    nombre: "Limon 18 kg",
    tipo: "exportacion",
    peso_kg: 18,
  },
  ...overrides,
});
