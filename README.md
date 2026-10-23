# Facturas

Panel web para consultar el histórico de facturas del hogar. Mantiene las series y cálculos del Excel original, con vistas compactas para vivienda, luz, suelo radiante y vehículo.

También permite subir facturas PDF de agua, luz y calefacción. En Cloudflare, Workers AI convierte el documento a texto y extrae los campos; el usuario revisa los datos antes de guardarlos en D1. El PDF original se archiva con un nombre normalizado en el bucket R2 `facturas-archivo`, bajo `archivo/`, para que Synology Cloud Sync lo descargue a la estructura existente.

## Desarrollo local

```bash
npm install
npm run db:local
npm run dev
```

El comando `npm run dev` marca el entorno como local y desactiva deliberadamente el procesado de PDF: las pruebas locales no envían documentos a Workers AI ni los escriben en R2. Las funciones de normalización y nombres se prueban con datos sintéticos mediante `npm run check`.

## Flujo de facturas PDF

El despliegue requiere los bindings declarados en `wrangler.toml`:

- `AI`: Workers AI para conversión de PDF y extracción estructurada.
- `INVOICE_BUCKET`: bucket R2 `facturas-archivo`.
- `DB`: D1 con la migración `0006_invoice_documents.sql` aplicada.

Los objetos se escriben en estas rutas:

```text
archivo/Facturas Agua/<vivienda>/...
archivo/Facturas Luz/<vivienda>/...
archivo/Facturas Calefacción/<vivienda>/...
```

Cloud Sync debe usar `archivo` como ruta remota, descarga unidireccional y la opción de conservar los archivos locales cuando se eliminen en origen.

## Actualizar los datos del Excel

El importador lee el libro de la ubicación configurada en `scripts/export_seed.py` y regenera la instantánea local y la migración de D1:

```bash
python scripts/export_seed.py
```

Si la primera migración ya se aplicó en producción, crea una migración nueva para el siguiente conjunto de datos en vez de modificar el historial aplicado.

## Despliegue

El Worker está conectado directamente con este repositorio mediante Cloudflare Builds. Cada commit a `main` ejecuta las comprobaciones, aplica las migraciones a `aportes-comunes-db` y publica el Worker. GitHub Actions también valida los commits y pull requests, pero no realiza el despliegue.

Ruta pública: `https://danieta.com/facturas`
