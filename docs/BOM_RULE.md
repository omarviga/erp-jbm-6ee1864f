# Regla Técnica: Motor BOM de Insumos

Fecha: 2026-09-30
Estado: Vigente

## Regla

El consumo de materiales por corrida se calcula con factores oficiales
(`src/lib/insumos/bom.ts`), no con valores dispersos en la UI.

## Factores oficiales por presentación

| Presentación | kg/caja | Cajas/tarima | Encerado | Papel |
|---|---|---|---|---|
| Exportación 18.14 kg | 18.14 | 54 | Sí | Sí |
| Master 15 kg | 15 | 60 | Sí | No |
| Nacional 20 kg | 20 | 48 | No | No |
| Arpilla 25 kg | 25 | 40 | No | No |
| Telescópica 4.5 kg | 4.5 | 120 | Sí | Sí |

- Cera: 0.5 L por cada 1000 kg de fruta (0.0005 L/kg); tambo = 200 L.
- Tarimas = techo(cajas / cajas_por_tarima); 4 esquineros y 4 grapas por tarima.
- Doble etiqueta por caja: PLU (#4048 calibres V-X/V-XX/V-XXX, #4045 resto)
  + SENASICA/QR.
- Papel encerado: 1 por caja, solo presentaciones marcadas.

## Capacidad y costos

- Capacidad por material = piso(stock / tasa_por_caja); el mínimo es el
  cuello de botella. Materiales sin aplicación o sin dato no limitan.
- Costos: total = Σ consumo × costo_unitario; por caja y por kilo prorratean.
- El simulador es proyección de solo lectura: no descuenta stock. El
  descuento real sigue ocurriendo al cerrar la corrida en Producción (RPC).

## Supuestos a confirmar

- Nacional 20 kg consume del bucket `caja_plastica`.
- Stock de cera expresado en litros.
- Grapas, etiquetas y papel no tienen bucket de stock: el simulador los
  marca "Sin control" y no los considera en el tope.
