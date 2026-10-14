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

El Worker está conectado directamente con este repositorio mediante Cloudflare Builds. Cada commit a `main` ejecuta las comprobaciones, aplica las migraciones a `aportes-comunes-db` y publica el Worker. GitHub Actions también valida los commits y pull requests, pero no realiza el despliegue.

Ruta pública: `https://danieta.com/facturas`
