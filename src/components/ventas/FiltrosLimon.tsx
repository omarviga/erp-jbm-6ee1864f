// src/components/ventas/FiltrosLimon.tsx
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TipoLimon, Calibre, Empaque } from "@/types/limon.types";

interface FiltrosLimonProps {
    tipoLimon: TipoLimon | 'todos';
    setTipoLimon: (tipo: TipoLimon | 'todos') => void;
    calibre: Calibre | 'todos';
    setCalibre: (calibre: Calibre | 'todos') => void;
    empaque: Empaque | 'todos';
    setEmpaque: (empaque: Empaque | 'todos') => void;
}

export function FiltrosLimon({
    tipoLimon,
    setTipoLimon,
    calibre,
    setCalibre,
    empaque,
    setEmpaque
}: FiltrosLimonProps) {
    return (
        <Card className="mb-4">
            <CardContent className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                    {/* Tipo de Limón */}
                    <div>
                        <Label className="text-sm font-semibold mb-2 block">Tipo de Limón</Label>
                        <Select value={tipoLimon} onValueChange={(v: TipoLimon | 'todos') => setTipoLimon(v)}>
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Todos los tipos" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="todos">Todos los tipos</SelectItem>
                                <SelectItem value="verde"> Verde</SelectItem>
                                <SelectItem value="alimonado"> Alimonado</SelectItem>
                                <SelectItem value="amarillo"> Amarillo</SelectItem>
                                <SelectItem value="economico"> Económico</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Calibre */}
                    <div>
                        <Label className="text-sm font-semibold mb-2 block">Calibre</Label>
                        <Select value={calibre} onValueChange={(v: Calibre | 'todos') => setCalibre(v)}>
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Todos los calibres" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="todos">Todos los calibres</SelectItem>
                                <SelectItem value="45">45</SelectItem>
                                <SelectItem value="X">X</SelectItem>
                                <SelectItem value="XX">XX</SelectItem>
                                <SelectItem value="XXX">XXX</SelectItem>
                                <SelectItem value="EXTRA">EXTRA</SelectItem>
                                <SelectItem value="SUPER">SUPER</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Empaque */}
                    <div>
                        <Label className="text-sm font-semibold mb-2 block">Empaque</Label>
                        <Tabs value={empaque} onValueChange={(v: Empaque | 'todos') => setEmpaque(v)} className="w-full">
                            <TabsList className="grid grid-cols-3 w-full">
                                <TabsTrigger value="todos">Todos</TabsTrigger>
                                <TabsTrigger value="caja"> Caja</TabsTrigger>
                                <TabsTrigger value="arpilla"> Arpilla</TabsTrigger>
                            </TabsList>
                        </Tabs>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}