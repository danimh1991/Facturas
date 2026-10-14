import fallbackData from "../data/seed.json";

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
const CATEGORIES = ["Alquiler", "Luz", "Calefacción", "Agua", "Internet", "Limpieza"];
const ENTRY_KINDS = new Set(["home", "electricity", "floor", "vehicle"]);

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function round(value, digits = 6) {
  const factor = 10 ** digits;
  return Math.round((number(value) + Number.EPSILON) * factor) / factor;
}

function isoDate(value) {
  const text = String(value || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function utcDate(value) {
  return new Date(`${value}T00:00:00Z`);
}

function inclusiveDays(start, end) {
  const first = isoDate(start);
  const last = isoDate(end);
  if (!first || !last) return 0;
  return Math.floor((utcDate(last) - utcDate(first)) / 86400000) + 1;
}

function monthKey(value) {
  return `${String(value).slice(0, 7)}-01`;
}

function emptyCategories() {
  return Object.fromEntries(CATEGORIES.map((category) => [category, 0]));
}

function emptyCategoryDetails() {
  return Object.fromEntries(CATEGORIES.map((category) => [category, []]));
}

function cloneBaseData() {
  return JSON.parse(JSON.stringify(fallbackData));
}

function allocateHomeEntry(data, payload, entryId = null) {
  const start = isoDate(payload.start_date || payload.date);
  const end = isoDate(payload.end_date || payload.date);
  const totalDays = inclusiveDays(start, end);
  const amount = number(payload.amount);
  if (!start || !end || totalDays < 1 || amount < 0 || !CATEGORIES.includes(payload.category)) return;

  data.invoices ||= [];
  data.invoices.push({
    id: entryId ? `app-${entryId}` : `app-${data.invoices.length + 1}`,
    entry_id: entryId,
    source: "app",
    property: payload.property,
    category: payload.category,
    start_date: start,
    end_date: end,
    days: totalDays,
    daily_average: round(amount / totalDays),
    total: amount,
  });

  const key = monthKey(start);
  let row = data.monthly.find((item) => item.property === payload.property && item.month === key);
  if (!row) {
    row = { property: payload.property, month: key, daily_average: 0, total: 0, categories: emptyCategories(), category_daily: emptyCategories(), category_details: emptyCategoryDetails() };
    data.monthly.push(row);
  }
  row.category_daily ||= emptyCategories();
  row.category_details ||= emptyCategoryDetails();
  row.categories[payload.category] = round(number(row.categories[payload.category]) + amount);
  row.category_daily[payload.category] = round(number(row.category_daily[payload.category]) + amount / totalDays);
  row.category_details[payload.category].push({ start_date: start, end_date: end, days: totalDays, daily_average: round(amount / totalDays), total: amount, entry_id: entryId });
  row.total = round(CATEGORIES.reduce((sum, category) => sum + number(row.categories[category]), 0));
  row.daily_average = round(CATEGORIES.reduce((sum, category) => sum + number(row.category_daily[category]), 0));
}

function electricityEntry(payload) {
  const days = inclusiveDays(payload.start_date, payload.end_date);
  const p1 = number(payload.p1);
  const p2 = number(payload.p2);
  const p3 = number(payload.p3);
  const consumption = round(p1 + p2 + p3);
  const amount = number(payload.amount);
  return {
    property: payload.property, company: payload.company || "—", month: monthKey(payload.start_date),
    start_date: isoDate(payload.start_date), end_date: isoDate(payload.end_date), days, amount,
    daily_amount: days ? round(amount / days) : 0, p1, p2, p3, consumption,
    daily_consumption: days ? round(consumption / days) : 0,
    cost_per_kwh: consumption ? round(amount / consumption) : 0,
    p1_share: consumption ? round(p1 / consumption) : 0,
    p2_share: consumption ? round(p2 / consumption) : 0,
    p3_share: consumption ? round(p3 / consumption) : 0,
  };
}

function floorEntry(payload) {
  const days = inclusiveDays(payload.start_date, payload.end_date);
  const coldKwh = number(payload.cold_kwh);
  const heatKwh = number(payload.heat_kwh);
  const waterM3 = number(payload.water_m3);
  const fixed = number(payload.fixed);
  const coldTotal = round(coldKwh * number(payload.cold_price));
  const heatTotal = round(heatKwh * number(payload.heat_price));
  const waterTotal = round(waterM3 * number(payload.water_price));
  const subtotal = round(coldTotal + heatTotal + waterTotal + fixed);
  const vatRate = number(payload.vat_rate, 21);
  const amount = round(subtotal * (1 + vatRate / 100));
  return {
    property: payload.property, company: payload.company || "—", month: monthKey(payload.start_date),
    start_date: isoDate(payload.start_date), end_date: isoDate(payload.end_date), days, amount,
    daily_amount: days ? round(amount / days) : 0,
    cold_kwh: coldKwh, cold_price: number(payload.cold_price), cold_total: coldTotal,
    heat_kwh: heatKwh, heat_price: number(payload.heat_price), heat_total: heatTotal,
    water_m3: waterM3, water_price: number(payload.water_price), water_total: waterTotal,
    fixed, vat_rate: vatRate,
    cold_share: amount ? round(coldTotal / amount) : 0,
    heat_share: amount ? round(heatTotal / amount) : 0,
    water_share: amount ? round(waterTotal / amount) : 0,
    fixed_share: amount ? round(fixed / amount) : 0,
  };
}

function vehicleEntry(payload) {
  const amount = number(payload.amount);
  const unitPrice = number(payload.unit_price);
  return {
    date: isoDate(payload.date), description: payload.description || payload.category || "Gasto",
    category: payload.category || "Otros", vehicle: payload.vehicle || null, amount,
    unit_price: unitPrice || null, quantity: unitPrice ? round(amount / unitPrice) : null,
  };
}

function applyEntry(data, entry) {
  const payload = JSON.parse(entry.payload);
  if (entry.kind === "home") allocateHomeEntry(data, payload, entry.id);
  if (entry.kind === "electricity") {
    const calculated = electricityEntry(payload);
    data.electricity.push(calculated);
    allocateHomeEntry(data, { ...payload, category: "Luz", amount: calculated.amount }, entry.id);
  }
  if (entry.kind === "floor") {
    const calculated = floorEntry(payload);
    data.floor.push(calculated);
    allocateHomeEntry(data, { ...payload, category: "Calefacción", amount: calculated.amount }, entry.id);
  }
  if (entry.kind === "vehicle") data.vehicle.push({ ...vehicleEntry(payload), entry_id: entry.id, source: "app" });
}

function finalizeData(data) {
  data.monthly.sort((a, b) => a.month.localeCompare(b.month));
  data.invoices.sort((a, b) => a.start_date.localeCompare(b.start_date) || a.category.localeCompare(b.category));
  data.electricity.sort((a, b) => a.month.localeCompare(b.month));
  data.floor.sort((a, b) => a.month.localeCompare(b.month));
  data.vehicle.sort((a, b) => a.date.localeCompare(b.date));
  let previousFuelDate = null;
  for (const row of data.vehicle) {
    if (row.category !== "Gasolina") continue;
    row.days_since_previous = previousFuelDate ? inclusiveDays(previousFuelDate, row.date) - 1 : null;
    previousFuelDate = row.date;
  }
  return data;
}

async function loadDashboard(db) {
  const data = cloneBaseData();
  const rows = await db.prepare("SELECT id, kind, payload, created_at FROM facturas_entries ORDER BY id").all();
  for (const entry of rows.results) applyEntry(data, entry);
  data.entries = rows.results.map((entry) => ({ id: entry.id, kind: entry.kind, payload: JSON.parse(entry.payload), created_at: entry.created_at }));
  data.meta = { ...data.meta, editable: true, added_entries: rows.results.length };
  return finalizeData(data);
}

function validateEntry(kind, payload) {
  if (!ENTRY_KINDS.has(kind)) return "Tipo de dato no válido";
  if (kind === "vehicle") {
    if (!isoDate(payload.date)) return "Indica una fecha válida";
  } else if (kind === "home") {
    if (!payload.property?.trim()) return "Indica la vivienda";
    if (!isoDate(payload.start_date) || !isoDate(payload.end_date) || inclusiveDays(payload.start_date, payload.end_date) < 1) return "El intervalo de fechas no es válido";
  } else {
    if (!payload.property?.trim()) return "Indica la vivienda";
    if (!isoDate(payload.start_date) || !isoDate(payload.end_date) || inclusiveDays(payload.start_date, payload.end_date) < 1) return "El intervalo de fechas no es válido";
  }
  if (kind === "home" && !CATEGORIES.includes(payload.category)) return "Categoría no válida";
  if (["home", "electricity", "vehicle"].includes(kind) && number(payload.amount, -1) < 0) return "El importe no es válido";
  return null;
}

async function createEntry(request, env) {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).hostname !== new URL(request.url).hostname) return json({ error: "Origen no permitido" }, 403);
  let body;
  try { body = await request.json(); } catch { return json({ error: "Datos no válidos" }, 400); }
  const kind = String(body.kind || "");
  const payload = body.payload && typeof body.payload === "object" ? body.payload : {};
  const error = validateEntry(kind, payload);
  if (error) return json({ error }, 400);
  await env.DB.prepare("INSERT INTO facturas_entries (kind, payload) VALUES (?, ?)").bind(kind, JSON.stringify(payload)).run();
  return json({ ok: true }, 201);
}

async function updateEntry(request, env, id) {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).hostname !== new URL(request.url).hostname) return json({ error: "Origen no permitido" }, 403);
  let body;
  try { body = await request.json(); } catch { return json({ error: "Datos no válidos" }, 400); }
  const kind = String(body.kind || "");
  const payload = body.payload && typeof body.payload === "object" ? body.payload : {};
  const error = validateEntry(kind, payload);
  if (error) return json({ error }, 400);
  const result = await env.DB.prepare("UPDATE facturas_entries SET kind = ?, payload = ? WHERE id = ?").bind(kind, JSON.stringify(payload), id).run();
  if (!result.meta?.changes) return json({ error: "El registro ya no existe" }, 404);
  return json({ ok: true, id });
}

async function serveAsset(request, env, pathname) {
  if (pathname === "/") return Response.redirect(new URL("/facturas/", request.url), 302);
  if (pathname === "/facturas") return Response.redirect(new URL("/facturas/", request.url), 308);
  let assetPath = pathname;
  if (pathname === "/facturas/") assetPath = "/facturas/index.html";
  const assetUrl = new URL(request.url);
  assetUrl.pathname = assetPath;
  let response = await env.ASSETS.fetch(new Request(assetUrl, request));
  if (response.status === 404 && !assetPath.includes(".")) {
    assetUrl.pathname = "/facturas/index.html";
    response = await env.ASSETS.fetch(new Request(assetUrl, request));
  }
  return response;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const apiPath = pathname.startsWith("/facturas/") ? pathname.slice("/facturas".length) : pathname;
    if (apiPath === "/api/health") return json({ ok: true, service: "facturas", storage: "D1", editable: true });
    if (apiPath === "/api/dashboard" && request.method === "GET") {
      try { return json(await loadDashboard(env.DB)); }
      catch (error) {
        console.error("D1 unavailable; serving bundled workbook snapshot", error);
        return json({ ...finalizeData(cloneBaseData()), meta: { ...fallbackData.meta, fallback: true, editable: false } });
      }
    }
    if (apiPath === "/api/entries" && request.method === "POST") return createEntry(request, env);
    const entryMatch = apiPath.match(/^\/api\/entries\/(\d+)$/);
    if (entryMatch && request.method === "PUT") return updateEntry(request, env, Number(entryMatch[1]));
    if (apiPath.startsWith("/api/")) return json({ error: "Ruta o método no permitido" }, 405);
    return serveAsset(request, env, pathname);
  },
};
