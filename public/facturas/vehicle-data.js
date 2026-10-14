export function summarizeVehicleExpenses(rows, keyLength) {
  const summaries = new Map();

  rows.forEach((row) => {
    const key = row.date.slice(0, keyLength);
    const current = summaries.get(key) || { key, count: 0, total: 0 };
    current.count += 1;
    current.total += Number(row.amount) || 0;
    summaries.set(key, current);
  });

  return [...summaries.values()].sort((a, b) => a.key.localeCompare(b.key));
}
