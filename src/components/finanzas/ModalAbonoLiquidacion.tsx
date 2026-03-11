import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ModalAbonoProps {
  isOpen: boolean;
  onClose: () => void;
  liquidacionId: string;
  productorId: string;
  productorNombre: string;
  saldoPendiente: number;
  onSuccess: () => void; // Función para recargar la tabla cuando terminemos
}

export function ModalAbonoLiquidacion({ isOpen, onClose, liquidacionId, productorId, productorNombre, saldoPendiente, onSuccess }: ModalAbonoProps) {
  const { toast } = useToast();
  const [monto, setMonto] = useState("");
  const [formaPago, setFormaPago] = useState("transferencia");
  const [referencia, setReferencia] = useState("");
  const [guardando, setGuardando] = useState(false);

  const handleGuardarAbono = async () => {
    const montoNum = parseFloat(monto);
    if (!montoNum || montoNum <= 0) {
      toast({ title: "Monto inválido", description: "Ingresa un monto mayor a cero.", variant: "destructive" });
      return;
    }
    
    if (montoNum > saldoPendiente) {
      toast({ title: "Excede el saldo", description: `El productor solo debe $${saldoPendiente.toLocaleString()}`, variant: "destructive" });
      return;
    }

    if (formaPago === 'cheque' && !referencia.trim()) {
      toast({ title: "Falta referencia", description: "El pago con cheque requiere número de referencia.", variant: "destructive" });
      return;
    }

    try {
      setGuardando(true);
      const nuevoSaldo = saldoPendiente - montoNum;
      const nuevoEstado = nuevoSaldo <= 0.01 ? 'PAGADA' : 'AUTORIZADA'; // Si ya se liquidó, cambia estado

      // 1. Guardar el historial del abono
      const { error: errorAbono } = await supabase
        .from('liquidacion_pagos')
        .insert({
          liquidacion_id: liquidacionId,
          monto: montoNum,
          forma_pago: formaPago,
          referencia: referencia.trim() || null
        });

      if (errorAbono) throw errorAbono;

      // 2. Descontar la deuda de la tabla principal
      const { error: errorActualizacion } = await supabase
        .from('liquidaciones')
        .update({ 
          saldo_pendiente_liq: nuevoSaldo,
          estado_liq: nuevoEstado
        })
        .eq('id', liquidacionId);

      if (errorActualizacion) throw errorActualizacion;

      const { error: errorSyncCxp } = await supabase.rpc('sync_productor_saldo_pendiente', {
        p_productor_id: productorId,
      });

      if (errorSyncCxp) throw errorSyncCxp;

      toast({
        title: "✅ Abono registrado",
        description: `Se abonaron $${montoNum.toLocaleString()} a ${productorNombre}.`,
        className: "bg-emerald-600 text-white border-none"
      });
      
      onSuccess(); // Recargamos datos
      onClose(); // Cerramos modal
      setMonto(""); setReferencia(""); // Limpiamos campos
      
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "No se pudo registrar el abono", variant: "destructive" });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Abonar a Liquidación</DialogTitle>
          <DialogDescription>
            Productor: <strong className="text-slate-800">{productorNombre}</strong><br/>
            Deuda Actual: <strong className="text-red-600 font-mono">${saldoPendiente.toLocaleString('es-MX', {minimumFractionDigits: 2})}</strong>
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label>Monto a Abonar ($)</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input 
                type="number" 
                placeholder="0.00" 
                className="pl-9 font-mono text-lg"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                autoFocus
              />
            </div>
            <p className="text-xs text-slate-500 cursor-pointer hover:text-blue-600" onClick={() => setMonto(saldoPendiente.toString())}>
              Liquidar el total exacto
            </p>
          </div>
          <div className="space-y-2">
            <Label>Forma de Pago</Label>
            <Select value={formaPago} onValueChange={setFormaPago}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="transferencia">Transferencia Bancaria</SelectItem>
                <SelectItem value="cheque">Cheque</SelectItem>
                <SelectItem value="efectivo">Efectivo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Referencia / Folio (Opcional)</Label>
            <Input 
              placeholder="Ej. TR-45890" 
              value={referencia}
              onChange={(e) => setReferencia(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={guardando}>Cancelar</Button>
          <Button onClick={handleGuardarAbono} disabled={guardando} className="bg-blue-600 hover:bg-blue-700">
            {guardando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : "Guardar Abono"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
