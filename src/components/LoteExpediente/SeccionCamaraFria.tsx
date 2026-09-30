import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SeccionCamaraFriaProps {
  produccion: unknown[];
}

const SeccionCamaraFria: React.FC<SeccionCamaraFriaProps> = ({ produccion }) => {
  return (
    <Card className="module-card">
      <CardHeader>
        <CardTitle>❄️ Sección Cámara Fría</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Información de cámara fría próximamente...
        </p>
      </CardContent>
    </Card>
  );
};

export default SeccionCamaraFria;