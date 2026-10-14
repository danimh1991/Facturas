import assert from "node:assert/strict";
import test from "node:test";

import { carryForwardZeros } from "../public/facturas/chart-data.js";

test("category charts carry the previous value through months without an invoice", () => {
  assert.deepEqual(carryForwardZeros([0, 0.36, 0, 0.42, 0, 0]), [0, 0.36, 0.36, 0.42, 0.42, 0.42]);
});

test("carrying values does not mutate the source series", () => {
  const values = [0.36, 0];
  carryForwardZeros(values);
  assert.deepEqual(values, [0.36, 0]);
});
