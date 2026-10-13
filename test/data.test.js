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

test("calculated workbook fields remain available as formulas in the app", () => {
  const light = data.electricity.find((row) => row.consumption > 0 && row.amount > 0);
  assert.ok(Math.abs(light.daily_consumption - light.consumption / light.days) < 0.000001);
  assert.ok(Math.abs(light.cost_per_kwh - light.amount / light.consumption) < 0.000001);

  const floor = data.floor.find((row) => row.amount > 0);
  assert.ok(Math.abs(floor.daily_amount - floor.amount / floor.days) < 0.000001);
  assert.ok(Math.abs(floor.cold_total - floor.cold_kwh * floor.cold_price) < 0.01);

  const fuel = data.vehicle.find((row) => row.unit_price > 0 && row.amount > 0);
  assert.ok(Math.abs(fuel.quantity - fuel.amount / fuel.unit_price) < 0.000001);
});
