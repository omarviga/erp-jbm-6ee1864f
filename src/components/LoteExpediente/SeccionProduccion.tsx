import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SeccionProduccionProps {
  produccion: unknown[];
}

const SeccionProduccion: React.FC<SeccionProduccionProps> = ({ produccion }) => {
  return (
    <Card className="module-card">
      <CardHeader>
        <CardTitle>📦 Sección de Producción</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Información de producción próximamente...
        </p>
      </CardContent>
    </Card>
  );
};

export default SeccionProduccion;