import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const data = JSON.parse(await readFile(new URL("../data/seed.json", import.meta.url), "utf8"));

test("exports the workbook history used by the dashboard", () => {
  assert.equal(data.invoices.length, 567);
  assert.equal(data.monthly.length, 109);
  assert.equal(data.electricity.length, 74);
  assert.equal(data.floor.length, 19);
  assert.equal(data.vehicle.length, 101);
  assert.equal(data.summary.find((row) => row.property === "Total" && row.category === "Total").total, 93767.52);
});

test("invoice history is a direct export of the Facturas periods", () => {
  const sample = data.invoices.find((row) => row.source_row === 4 && row.category === "Luz");
  assert.deepEqual(sample, {
    id: "excel-facturas-4-luz",
    source: "excel",
    source_sheet: "Facturas",
    source_row: 4,
    property: "Ana de Austria",
    category: "Luz",
    start_date: "2017-10-01",
    end_date: "2017-11-23",
    days: 54,
    daily_average: 1.722593,
    total: 93.02,
  });
  for (const row of data.invoices) {
    assert.ok(row.start_date <= row.end_date);
    assert.ok(Math.abs(row.daily_average - row.total / row.days) < 0.000001);
  }
});

test("monthly rows group complete invoices by their start month", () => {
  const months = data.monthly.map((row) => row.month);
  assert.deepEqual(months, [...months].sort());
  for (const row of data.monthly) {
    assert.ok(row.total >= 0);
    const categoryTotal = Object.values(row.categories).reduce((total, value) => total + value, 0);
    assert.ok(Math.abs(categoryTotal - row.total) < 0.000001, `${row.month} differs by ${categoryTotal - row.total}`);
    const dailyTotal = Object.values(row.category_daily).reduce((total, value) => total + value, 0);
    assert.ok(Math.abs(dailyTotal - row.daily_average) < 0.000001);
  }
  const invoiceTotal = data.invoices.reduce((total, row) => total + row.total, 0);
  const monthlyTotal = data.monthly.reduce((total, row) => total + row.total, 0);
  assert.ok(Math.abs(monthlyTotal - invoiceTotal) < 0.000001);

  const october = data.monthly.find((row) => row.property === "Ana de Austria" && row.month === "2017-10-01");
  assert.equal(october.categories.Luz, 93.02);
  assert.equal(october.category_details.Luz[0].start_date, "2017-10-01");
  assert.equal(october.category_details.Luz[0].end_date, "2017-11-23");
  assert.equal(october.category_details.Luz[0].days, 54);
  assert.equal(october.category_details.Luz[0].daily_average, 1.722593);
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

test("vehicle history excludes test data before 5 March 2023", () => {
  assert.ok(data.vehicle.length > 0);
  assert.ok(data.vehicle.every((row) => row.date >= "2023-03-05"));
});

test("light and floor use the real inclusive period and its start month", () => {
  for (const row of [...data.electricity, ...data.floor]) {
    const start = new Date(`${row.start_date}T00:00:00Z`);
    const end = new Date(`${row.end_date}T00:00:00Z`);
    const inclusiveDays = Math.floor((end - start) / 86400000) + 1;
    assert.equal(row.days, inclusiveDays);
    assert.equal(row.month, `${row.start_date.slice(0, 7)}-01`);
    assert.ok(Math.abs(row.daily_amount - row.amount / row.days) < 0.000001);
  }

  const shiftedLight = data.electricity.find((row) => row.start_date === "2021-03-05");
  assert.equal(shiftedLight.month, "2021-03-01");
  const firstFloor = data.floor[0];
  assert.equal(firstFloor.start_date, "2024-12-02");
  assert.equal(firstFloor.month, "2024-12-01");
  assert.equal(firstFloor.days, 57);
});
