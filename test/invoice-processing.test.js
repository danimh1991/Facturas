import assert from "node:assert/strict";
import test from "node:test";

import {
  archivePlanForEntry,
  isLocalInvoiceEnvironment,
  normalizeInvoiceExtraction,
  parseAiInvoiceResponse,
} from "../src/invoice-processing.js";

test("normalizes Canal water invoices and follows the existing archive convention", () => {
  const invoice = normalizeInvoiceExtraction({
    invoice_type: "water",
    property: "C/ de Cesar Cort Boti 59",
    provider: "Canal de Isabel II",
    invoice_number: "260005047605",
    period_start: "2026-05-12",
    period_end: "2026-07-09",
    invoice_total: 32.71,
    water_consumption_m3: 15,
    confidence: 0.99,
    observations: "",
  });

  assert.equal(invoice.kind, "home");
  assert.equal(invoice.payload.property, "César Cort Botí");
  assert.equal(invoice.payload.start_date, "2026-05-13");
  assert.equal(invoice.payload.end_date, "2026-07-09");
  assert.equal(invoice.payload.water_m3, 15);
  assert.equal(invoice.archiveName, "CANAL 20260513-20260709.pdf");
  assert.equal(invoice.archiveKey, "archivo/Facturas Agua/Cesar Cort Botí/CANAL 20260513-20260709.pdf");
});

test("uses the invoice total before Octopus account credit and preserves P1-P3", () => {
  const invoice = normalizeInvoiceExtraction({
    invoice_type: "electricity",
    property: "CL Cesar cort boti, 59, PS. 6 PTA. A",
    provider: "Octopus Energy España",
    invoice_number: "2026ENM00092779",
    period_start: "2026-07-28",
    period_end: "2026-08-28",
    invoice_total: 40.82,
    electricity_p1_kwh: 30,
    electricity_p2_kwh: 36,
    electricity_p3_kwh: 58,
    confidence: 0.98,
    observations: "El total a pagar es 40,70 por un crédito previo de 0,12",
  });

  assert.equal(invoice.kind, "electricity");
  assert.equal(invoice.payload.start_date, "2026-07-29");
  assert.equal(invoice.payload.amount, 40.82);
  assert.deepEqual([invoice.payload.p1, invoice.payload.p2, invoice.payload.p3], [30, 36, 58]);
  assert.equal(invoice.archiveName, "20260729-20260828 Octopus.pdf");
  assert.equal(invoice.archiveKey, "archivo/Facturas Luz/César Cort Boti/20260729-20260828 Octopus.pdf");
});

test("converts Sunflowers ACS liters and prices to the dashboard units", () => {
  const invoice = normalizeInvoiceExtraction({
    invoice_type: "heating",
    property: "CL CESAR CORT BOTI 59 - 6.A",
    provider: "SUNFLOWER ENERGIAS, S.L.",
    invoice_number: "21173R000580/26",
    period_start: "2026-06-16",
    period_end: "2026-07-15",
    invoice_total: 49.07,
    heating_cold_kwh: 755,
    heating_cold_price: 0.04,
    heating_heat_kwh: 0,
    heating_heat_price: 0.04,
    heating_water_liters: 2445,
    heating_water_price_per_liter: 0.0025,
    heating_fixed_amount: 12.76,
    vat_rate: 0,
    confidence: 0.99,
    observations: "",
  });

  assert.equal(invoice.kind, "floor");
  assert.equal(invoice.payload.start_date, "2026-06-17");
  assert.equal(invoice.payload.water_m3, 2.445);
  assert.equal(invoice.payload.water_price, 2.5);
  assert.equal(invoice.payload.amount, 49.07);
  assert.equal(invoice.archiveName, "20260617-20260715 SUNFLOWERS.pdf");
});

test("archive names are recalculated from reviewed form values", () => {
  const plan = archivePlanForEntry("electricity", {
    property: "César Cort Botí",
    company: "Naturgy",
    start_date: "2026-09-01",
    end_date: "2026-09-30",
  });
  assert.equal(plan.archiveName, "20260901-20260930 Naturgy.pdf");
});

test("parses both direct and fenced Workers AI JSON responses", () => {
  assert.deepEqual(parseAiInvoiceResponse({ response: { invoice_type: "water" } }), { invoice_type: "water" });
  assert.deepEqual(parseAiInvoiceResponse({ response: "```json\n{\"invoice_type\":\"electricity\"}\n```" }), { invoice_type: "electricity" });
});

test("local development remains local even when Wrangler rewrites the route hostname", () => {
  assert.equal(isLocalInvoiceEnvironment("https://danieta.com/api/invoices/preview", "local"), true);
  assert.equal(isLocalInvoiceEnvironment("https://danieta.com/api/invoices/preview"), false);
  assert.equal(isLocalInvoiceEnvironment("http://127.0.0.1:8787/api/invoices/preview"), true);
});
