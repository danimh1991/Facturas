DELETE FROM facturas_vehicle
WHERE date < '2023-03-05';

DELETE FROM facturas_entries
WHERE kind = 'vehicle'
  AND json_extract(payload, '$.date') < '2023-03-05';
