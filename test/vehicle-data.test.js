import assert from "node:assert/strict";
import test from "node:test";

import { summarizeVehicleExpenses } from "../public/facturas/vehicle-data.js";

const rows = [
  { date: "2025-12-20", amount: 40 },
  { date: "2026-01-03", amount: 50 },
  { date: "2026-01-18", amount: 25 },
  { date: "2026-03-02", amount: 60 },
];

test("vehicle expenses are summarized by month", () => {
  assert.deepEqual(summarizeVehicleExpenses(rows, 7), [
    { key: "2025-12", count: 1, total: 40 },
    { key: "2026-01", count: 2, total: 75 },
    { key: "2026-03", count: 1, total: 60 },
  ]);
});

test("vehicle expenses are summarized by year", () => {
  assert.deepEqual(summarizeVehicleExpenses(rows, 4), [
    { key: "2025", count: 1, total: 40 },
    { key: "2026", count: 3, total: 135 },
  ]);
});
