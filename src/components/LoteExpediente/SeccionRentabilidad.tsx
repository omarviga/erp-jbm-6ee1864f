import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SeccionRentabilidadProps {
  lote: unknown;
  analisis: unknown;
}

const SeccionRentabilidad: React.FC<SeccionRentabilidadProps> = ({ lote, analisis }) => {
  return (
    <Card className="module-card">
      <CardHeader>
        <CardTitle>💰 Sección Rentabilidad</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Análisis de rentabilidad próximamente...
        </p>
      </CardContent>
    </Card>
  );
};

export default SeccionRentabilidad;