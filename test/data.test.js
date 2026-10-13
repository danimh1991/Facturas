import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const data = JSON.parse(await readFile(new URL("../data/seed.json", import.meta.url), "utf8"));

test("exports the workbook history used by the dashboard", () => {
  assert.equal(data.monthly.length, 107);
  assert.equal(data.electricity.length, 74);
  assert.equal(data.floor.length, 19);
  assert.equal(data.vehicle.length, 139);
  assert.equal(data.summary.find((row) => row.property === "Total" && row.category === "Total").total, 93767.52);
});

test("monthly rows are chronological and internally consistent", () => {
  const months = data.monthly.map((row) => row.month);
  assert.deepEqual(months, [...months].sort());
  for (const row of data.monthly) {
    assert.ok(row.total >= 0);
    assert.ok(row.days > 0);
    const categoryTotal = Object.values(row.categories).reduce((total, value) => total + value, 0);
    assert.ok(Math.abs(categoryTotal - row.total) < 2, `${row.month} differs by ${categoryTotal - row.total}`);
  }
});

test("excluded calculation sheets are not exported", () => {
  assert.deepEqual(data.meta.excluded_sheets, ["Previsión Luz", "X Gasolina Moto", "Comparación"]);
});
