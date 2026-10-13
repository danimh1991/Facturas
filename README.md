# Facturas

Panel web para consultar el histórico de facturas del hogar. Mantiene las series y cálculos del Excel original, con vistas compactas para vivienda, luz, suelo radiante y vehículo.

## Desarrollo local

```bash
npm install
npm run db:local
npm run dev
```

## Actualizar los datos del Excel

El importador lee el libro de la ubicación configurada en `scripts/export_seed.py` y regenera la instantánea local y la migración de D1:

```bash
python scripts/export_seed.py
```

Si la primera migración ya se aplicó en producción, crea una migración nueva para el siguiente conjunto de datos en vez de modificar el historial aplicado.

## Despliegue

Cada commit a `main` ejecuta las comprobaciones, aplica las migraciones a `aportes-comunes-db` y publica el Worker. El repositorio necesita el secreto `CLOUDFLARE_API_TOKEN` con permisos de Workers y D1.

Ruta pública: `https://danieta.com/facturas`
