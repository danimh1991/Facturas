UPDATE facturas_vehicle
SET category = description
WHERE date >= '2023-03-05'
  AND description IN ('Seguro', 'Taller', 'Ad Blue');
