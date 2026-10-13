const COLORS = ["#2f6f5d", "#e78466", "#d8a94a", "#6c8ebf", "#9d7bb0", "#8dc9b5"];
const CATEGORY_ORDER = ["Alquiler", "Luz", "Calefacción", "Agua", "Internet", "Limpieza"];
const VIEW_COPY = {
  resumen: ["VISIÓN GENERAL", "Tus gastos, con perspectiva"],
  historico: ["HISTÓRICO", "Todos los meses, sin perderte"],
  luz: ["ENERGÍA", "Consumo y gasto de luz"],
  suelo: ["CLIMATIZACIÓN", "Suelo radiante y agua"],
  vehiculo: ["MOVILIDAD", "Gastos del vehículo"],
  comparar: ["SIMULADOR", "Una comparación sencilla"],
};

const state = { data: null, property: "Todas", period: "all", page: 1, pageSize: 12, query: "" };
const euro = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });
const compactEuro = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 });
const monthFmt = new Intl.DateTimeFormat("es-ES", { month: "short", year: "2-digit", timeZone: "UTC" });
const fullMonthFmt = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric", timeZone: "UTC" });
const percent = new Intl.NumberFormat("es-ES", { style: "percent", maximumFractionDigits: 1 });

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const sum = (items, selector = (value) => value) => items.reduce((total, item) => total + (Number(selector(item)) || 0), 0);
const mean = (values) => values.length ? sum(values) / values.length : 0;
const esc = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
const dateValue = (value) => new Date(`${String(value).slice(0, 10)}T00:00:00Z`);
const labelMonth = (value, full = false) => (full ? fullMonthFmt : monthFmt).format(dateValue(value)).replace(" de ", " ");
const today = () => new Date().toISOString().slice(0, 10);
const daysBetween = (start, end) => start && end ? Math.max(0, Math.floor((dateValue(end) - dateValue(start)) / 86400000) + 1) : 0;

function propertyInput() {
  const properties = [...new Set(state.data.monthly.map((row) => row.property))];
  const selected = state.property !== "Todas" ? state.property : properties.at(-1) || "";
  return `<label class="form-field">Vivienda<input name="property" list="property-list" required value="${esc(selected)}" /></label><datalist id="property-list">${properties.map((property) => `<option value="${esc(property)}"></option>`).join("")}</datalist>`;
}

function moneyField(name, label, value = "") {
  return `<label class="form-field">${label}<input name="${name}" type="number" min="0" step="0.01" ${value !== "" ? `value="${value}"` : ""} required /></label>`;
}

function entryFieldsMarkup(kind) {
  const date = today();
  if (kind === "home") return `${propertyInput()}<label class="form-field">Categoría<select name="category" required>${CATEGORY_ORDER.map((item) => `<option>${item}</option>`).join("")}</select></label><label class="form-field">Fecha de inicio<input name="start_date" type="date" value="${date}" required /></label><label class="form-field">Fecha de fin<input name="end_date" type="date" value="${date}" required /></label>${moneyField("amount", "Importe total (€)")}`;
  if (kind === "electricity") return `${propertyInput()}<label class="form-field">Compañía<input name="company" required /></label><label class="form-field">Fecha de inicio<input name="start_date" type="date" value="${date}" required /></label><label class="form-field">Fecha de fin<input name="end_date" type="date" value="${date}" required /></label>${moneyField("amount", "Importe total (€)")}${moneyField("p1", "Consumo P1 (kWh)", 0)}${moneyField("p2", "Consumo P2 (kWh)", 0)}${moneyField("p3", "Consumo P3 (kWh)", 0)}`;
  if (kind === "floor") return `${propertyInput()}<label class="form-field">Compañía<input name="company" required /></label><label class="form-field">Fecha de inicio<input name="start_date" type="date" value="${date}" required /></label><label class="form-field">Fecha de fin<input name="end_date" type="date" value="${date}" required /></label>${moneyField("cold_kwh", "Consumo frío (kWh)", 0)}${moneyField("cold_price", "Precio frío (€/kWh)", 0)}${moneyField("heat_kwh", "Consumo calor (kWh)", 0)}${moneyField("heat_price", "Precio calor (€/kWh)", 0)}${moneyField("water_m3", "Consumo agua (m³)", 0)}${moneyField("water_price", "Precio agua (€/m³)", 0)}${moneyField("fixed", "Cuota fija (€)", 0)}<label class="form-field">IVA (%)<input name="vat_rate" type="number" min="0" step="0.1" value="21" required /></label>`;
  return `<label class="form-field">Fecha<input name="date" type="date" value="${date}" required /></label><label class="form-field">Categoría<select name="category"><option>Gasolina</option><option>Seguro</option><option>Taller</option><option>Impuestos</option><option>Otros</option></select></label><label class="form-field">Vehículo<input name="vehicle" placeholder="Coche, moto…" /></label><label class="form-field">Descripción<input name="description" /></label>${moneyField("amount", "Importe total (€)")}<label class="form-field">Precio por litro (€)<input name="unit_price" type="number" min="0" step="0.001" /></label>`;
}

function entryValues() {
  const form = new FormData($("#entry-form"));
  return Object.fromEntries(form.entries());
}

function renderEntryPreview() {
  const values = entryValues();
  const n = (name) => Math.max(0, Number(values[name]) || 0);
  const days = daysBetween(values.start_date, values.end_date);
  let lines = [];
  if (values.kind === "home") lines = [["Días incluidos", days || "—"], ["Media diaria", days ? euro.format(n("amount") / days) : "—"], ["Cálculo mensual", "Prorrateo por días de cada mes"]];
  if (values.kind === "electricity") {
    const consumption = n("p1") + n("p2") + n("p3");
    lines = [["Días", days || "—"], ["Consumo total", `${decimal.format(consumption)} kWh`], ["Consumo diario", days ? `${decimal.format(consumption / days)} kWh` : "—"], ["Coste por kWh", consumption ? euro.format(n("amount") / consumption) : "—"]];
  }
  if (values.kind === "floor") {
    const cold = n("cold_kwh") * n("cold_price"), heat = n("heat_kwh") * n("heat_price"), water = n("water_m3") * n("water_price");
    const total = (cold + heat + water + n("fixed")) * (1 + n("vat_rate") / 100);
    lines = [["Frío", euro.format(cold)], ["Calor", euro.format(heat)], ["Agua", euro.format(water)], ["Factura calculada", euro.format(total)], ["Importe diario", days ? euro.format(total / days) : "—"]];
  }
  if (values.kind === "vehicle") lines = [["Cantidad calculada", n("unit_price") ? `${decimal.format(n("amount") / n("unit_price"))} l` : "Añade el precio/litro"], ["Resumen", "Se agrega al mes, año y categoría"]];
  $("#entry-preview").innerHTML = `<strong>Cálculos automáticos</strong>${lines.map(([label, value]) => `<span><small>${label}</small><b>${value}</b></span>`).join("")}`;
}

function renderEntryForm() {
  const kind = $("#entry-kind").value;
  $("#entry-fields").innerHTML = entryFieldsMarkup(kind);
  $("#entry-message").hidden = true;
  renderEntryPreview();
}

async function saveEntry(event) {
  event.preventDefault();
  const values = entryValues();
  const kind = values.kind;
  delete values.kind;
  const button = $("#save-entry");
  button.disabled = true;
  button.textContent = "Guardando…";
  const base = location.pathname.startsWith("/facturas") ? "/facturas" : "";
  try {
    const response = await fetch(`${base}/api/entries`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind, payload: values }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "No se pudo guardar");
    state.data = await loadData();
    fillFilters();
    renderAll();
    $("#entry-dialog").close();
  } catch (error) {
    $("#entry-message").textContent = error.message;
    $("#entry-message").hidden = false;
  } finally {
    button.disabled = false;
    button.textContent = "Guardar y recalcular";
  }
}

async function loadData() {
  const base = location.pathname.startsWith("/facturas") ? "/facturas" : "";
  try {
    const response = await fetch(`${base}/api/dashboard`);
    if (!response.ok) throw new Error(`API ${response.status}`);
    return await response.json();
  } catch (error) {
    const fallback = await fetch(`${base}/data.json`);
    if (!fallback.ok) throw error;
    return await fallback.json();
  }
}

function periodStart() {
  const rows = state.data.monthly;
  const latest = rows.length ? dateValue(rows.at(-1).month) : new Date();
  if (state.period === "12m") return new Date(Date.UTC(latest.getUTCFullYear(), latest.getUTCMonth() - 11, 1));
  if (/^\d{4}$/.test(state.period)) return new Date(`${state.period}-01-01T00:00:00Z`);
  return null;
}

function filteredMonthly() {
  const start = periodStart();
  return state.data.monthly.filter((row) => {
    const propertyOk = state.property === "Todas" || row.property === state.property;
    const periodOk = !start || dateValue(row.month) >= start && (state.period === "12m" || String(row.month).startsWith(state.period));
    return propertyOk && periodOk;
  });
}

function filterByGlobalPeriod(rows, field = "month") {
  const start = periodStart();
  return rows.filter((row) => {
    const propertyOk = state.property === "Todas" || !row.property || row.property === state.property;
    const periodOk = !start || dateValue(row[field]) >= start && (state.period === "12m" || String(row[field]).startsWith(state.period));
    return propertyOk && periodOk;
  });
}

function kpi(label, value, meta, featured = false) {
  return `<article class="kpi${featured ? " featured" : ""}"><div class="kpi-label">${label}</div><div class="kpi-value">${value}</div><div class="kpi-meta">${meta}</div></article>`;
}

function movingAverage(values, windowSize = 4) {
  return values.map((_, index) => mean(values.slice(Math.max(0, index - windowSize + 1), index + 1)));
}

function lineChart(container, series, options = {}) {
  if (!container) return;
  const usable = series.filter((item) => item.values?.length);
  if (!usable.length) { container.innerHTML = `<div class="empty">No hay datos para este filtro.</div>`; return; }
  const length = Math.max(...usable.map((item) => item.values.length));
  const allValues = usable.flatMap((item) => item.values).filter(Number.isFinite);
  const max = Math.max(...allValues, 1);
  const min = options.zeroBased === false ? Math.min(...allValues, 0) : 0;
  const width = 900, height = 250, pad = { left: 42, right: 15, top: 16, bottom: 28 };
  const x = (index) => pad.left + (length <= 1 ? 0 : index / (length - 1)) * (width - pad.left - pad.right);
  const y = (value) => pad.top + (max - value) / Math.max(max - min, .001) * (height - pad.top - pad.bottom);
  const grid = [0, .25, .5, .75, 1].map((ratio) => {
    const value = max - (max - min) * ratio;
    const py = pad.top + ratio * (height - pad.top - pad.bottom);
    return `<line class="grid-line" x1="${pad.left}" y1="${py}" x2="${width-pad.right}" y2="${py}"/><text class="axis-label" x="${pad.left-7}" y="${py+3}" text-anchor="end">${options.currency ? compactEuro.format(value) : decimal.format(value)}</text>`;
  }).join("");
  const labels = options.labels || [];
  const every = Math.max(1, Math.ceil(length / 7));
  const xLabels = labels.map((label, index) => index % every === 0 || index === length - 1 ? `<text class="axis-label" x="${x(index)}" y="${height-6}" text-anchor="middle">${esc(label)}</text>` : "").join("");
  const drawings = usable.map((item, seriesIndex) => {
    const color = item.color || COLORS[seriesIndex];
    const points = item.values.map((value, index) => `${x(index)},${y(Number(value) || 0)}`).join(" ");
    const area = item.area ? `<polygon class="chart-area" fill="${color}" points="${pad.left},${height-pad.bottom} ${points} ${x(item.values.length-1)},${height-pad.bottom}"/>` : "";
    const circles = item.values.map((value, index) => index === item.values.length - 1 ? `<circle class="chart-point" cx="${x(index)}" cy="${y(value)}" r="3.5" fill="${color}"/>` : "").join("");
    return `${area}<polyline class="chart-line" stroke="${color}" points="${points}"/>${circles}`;
  }).join("");
  container.innerHTML = `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">${grid}${xLabels}${drawings}</svg>`;
}

function donut(container, items, centerLabel = "Total") {
  if (!container) return;
  const clean = items.filter((item) => item.value > 0);
  const total = sum(clean, (item) => item.value);
  if (!total) { container.innerHTML = `<div class="empty">No hay datos para este filtro.</div>`; return; }
  let cursor = 0;
  const stops = clean.map((item, index) => {
    const start = cursor;
    cursor += item.value / total * 100;
    return `${item.color || COLORS[index % COLORS.length]} ${start}% ${cursor}%`;
  }).join(",");
  container.innerHTML = `<div class="donut" style="background:conic-gradient(${stops})"><div class="donut-center"><strong>${compactEuro.format(total)}</strong><small>${esc(centerLabel)}</small></div></div><div class="breakdown-list">${clean.map((item, index) => `<div class="breakdown-row"><i style="background:${item.color || COLORS[index % COLORS.length]}"></i><span>${esc(item.label)}</span><strong>${Math.round(item.value/total*100)}%</strong></div>`).join("")}</div>`;
}

function renderSummary() {
  const rows = filteredMonthly();
  const total = sum(rows, (row) => row.total);
  const daily = mean(rows.map((row) => row.daily_average));
  const latest = rows.at(-1);
  const previous = rows.at(-2);
  const change = previous ? ((latest.total - previous.total) / Math.max(previous.total, .01)) * 100 : 0;
  const years = new Set(rows.map((row) => row.month.slice(0, 4))).size;
  $("#kpis").innerHTML = [
    kpi("Gasto del periodo", compactEuro.format(total), `${rows.length} meses incluidos`, true),
    kpi("Media mensual", euro.format(mean(rows.map((row) => row.total))), `${euro.format(daily)} al día`),
    kpi("Último mes", latest ? euro.format(latest.total) : "—", latest ? `<span class="${change > 0 ? "trend-up" : "trend-down"}">${change > 0 ? "+" : ""}${decimal.format(change)}%</span> frente al anterior` : "Sin datos"),
    kpi("Cobertura", `${years} ${years === 1 ? "año" : "años"}`, rows.length ? `${labelMonth(rows[0].month, true)} — ${labelMonth(rows.at(-1).month, true)}` : "Sin datos"),
  ].join("");
  const chartRows = rows.slice(-48);
  lineChart($("#monthly-chart"), [
    { values: chartRows.map((row) => row.total), color: COLORS[0], area: true },
    { values: movingAverage(chartRows.map((row) => row.total), 4), color: COLORS[1] },
  ], { labels: chartRows.map((row) => labelMonth(row.month)), currency: true });
  const categoryItems = CATEGORY_ORDER.map((category, index) => ({ label: category, value: sum(rows, (row) => row.categories[category]), color: COLORS[index] }));
  donut($("#category-chart"), categoryItems, "en el periodo");
  const recent = rows.slice(-5).reverse();
  $("#recent-table").innerHTML = tableMarkup(["Mes", "Vivienda", "Total", "€/día", "Peso"], recent.map((row) => [labelMonth(row.month, true), row.property, euro.format(row.total), euro.format(row.daily_average), `<div class="microbar"><span style="width:${Math.min(100, row.total/Math.max(...recent.map((r)=>r.total),1)*100)}%"></span></div>`]), [2,3]);
}

function tableMarkup(headers, rows, numericColumns = []) {
  if (!rows.length) return `<div class="empty">No hay datos para este filtro.</div>`;
  return `<table><thead><tr>${headers.map((header, index) => `<th class="${numericColumns.includes(index) ? "number" : ""}">${esc(header)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell, index) => `<td class="${numericColumns.includes(index) ? "number" : ""}">${cell ?? "—"}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
}

function historyRows() {
  const query = state.query.toLocaleLowerCase("es");
  return filteredMonthly().filter((row) => !query || `${row.property} ${labelMonth(row.month, true)}`.toLocaleLowerCase("es").includes(query)).slice().reverse();
}

function renderHistory() {
  const rows = historyRows();
  const pages = Math.max(1, Math.ceil(rows.length / state.pageSize));
  state.page = Math.min(state.page, pages);
  const visible = rows.slice((state.page - 1) * state.pageSize, state.page * state.pageSize);
  $("#history-table").innerHTML = tableMarkup(["Mes", "Vivienda", ...CATEGORY_ORDER, "Total"], visible.map((row) => [labelMonth(row.month, true), esc(row.property), ...CATEGORY_ORDER.map((category) => euro.format(row.categories[category] || 0)), `<strong>${euro.format(row.total)}</strong>`]), [2,3,4,5,6,7,8]);
  $("#history-pagination").innerHTML = `<span>${rows.length ? (state.page-1)*state.pageSize+1 : 0}–${Math.min(state.page*state.pageSize,rows.length)} de ${rows.length}</span><div class="pagination-buttons"><button data-page="${state.page-1}" ${state.page===1?"disabled":""}>‹</button><button disabled>${state.page}</button><button data-page="${state.page+1}" ${state.page===pages?"disabled":""}>›</button></div>`;
  $$("#history-pagination [data-page]").forEach((button) => button.addEventListener("click", () => { state.page = Number(button.dataset.page); renderHistory(); }));
}

function renderLight() {
  const rows = filterByGlobalPeriod(state.data.electricity);
  const consumption = sum(rows, (row) => row.consumption);
  const latest = rows.at(-1);
  $("#light-kpis").innerHTML = [kpi("Facturas", rows.length, "periodos registrados", true), kpi("Gasto", euro.format(sum(rows, (r) => r.amount)), `${euro.format(mean(rows.map((r)=>r.amount)))} de media`), kpi("Consumo", `${decimal.format(consumption)} kWh`, `${decimal.format(mean(rows.map((r)=>r.daily_consumption)))} kWh/día`), kpi("Última compañía", latest?.company || "—", latest ? labelMonth(latest.month, true) : "Sin datos")].join("");
  const chartRows = rows.slice(-48);
  lineChart($("#light-cost-chart"), [{ values: chartRows.map((r)=>r.amount), color: COLORS[0], area: true }], { labels: chartRows.map((r)=>labelMonth(r.month)), currency: true });
  lineChart($("#light-use-chart"), [{ values: chartRows.map((r)=>r.p1), color: COLORS[1] }, { values: chartRows.map((r)=>r.p2), color: COLORS[2] }, { values: chartRows.map((r)=>r.p3), color: COLORS[3] }], { labels: chartRows.map((r)=>labelMonth(r.month)) });
  $("#light-table").innerHTML = tableMarkup(["Periodo", "Vivienda", "Compañía", "Días", "P1", "P2", "P3", "Total kWh", "kWh/día", "€/kWh", "Importe"], rows.slice().reverse().slice(0, 24).map((r)=>[labelMonth(r.month,true),esc(r.property),esc(r.company),r.days,decimal.format(r.p1),decimal.format(r.p2),decimal.format(r.p3),`<strong>${decimal.format(r.consumption)}</strong>`,decimal.format(r.daily_consumption),r.cost_per_kwh ? euro.format(r.cost_per_kwh) : "—",euro.format(r.amount)]), [3,4,5,6,7,8,9,10]);
}

function renderFloor() {
  const rows = filterByGlobalPeriod(state.data.floor);
  const latest = rows.at(-1);
  $("#floor-kpis").innerHTML = [kpi("Facturas", rows.length, "periodos registrados", true), kpi("Gasto", euro.format(sum(rows,(r)=>r.amount)), `${euro.format(mean(rows.map((r)=>r.amount)))} de media`), kpi("Energía", `${decimal.format(sum(rows,(r)=>r.cold_kwh+r.heat_kwh))} kWh`, "frío y calor"), kpi("Última compañía", latest?.company || "—", latest ? labelMonth(latest.month,true) : "Sin datos")].join("");
  lineChart($("#floor-cost-chart"), [{ values: rows.map((r)=>r.amount), color: COLORS[0], area: true }], { labels: rows.map((r)=>labelMonth(r.month)), currency: true });
  lineChart($("#floor-use-chart"), [{ values: rows.map((r)=>r.cold_kwh), color: COLORS[3] }, { values: rows.map((r)=>r.heat_kwh), color: COLORS[1] }, { values: rows.map((r)=>r.water_m3*50), color: COLORS[0] }], { labels: rows.map((r)=>labelMonth(r.month)) });
  $("#floor-table").innerHTML = tableMarkup(["Periodo", "Compañía", "Días", "Frío kWh", "Calor kWh", "Agua m³", "Fijo", "€/día", "Importe"], rows.slice().reverse().map((r)=>[labelMonth(r.month,true),esc(r.company),r.days,decimal.format(r.cold_kwh),decimal.format(r.heat_kwh),decimal.format(r.water_m3),euro.format(r.fixed),r.daily_amount ? euro.format(r.daily_amount) : euro.format(r.amount / Math.max(r.days,1)),euro.format(r.amount)]), [2,3,4,5,6,7,8]);
}

function renderVehicle() {
  const rows = filterByGlobalPeriod(state.data.vehicle, "date");
  const byMonth = new Map();
  rows.forEach((row) => { const key = row.date.slice(0,7); byMonth.set(key,(byMonth.get(key)||0)+row.amount); });
  const months = [...byMonth.keys()].sort();
  const categories = [...new Set(rows.map((r)=>r.category))];
  const latest = rows.at(-1);
  $("#vehicle-kpis").innerHTML = [kpi("Movimientos", rows.length, "gastos registrados", true), kpi("Gasto total", euro.format(sum(rows,(r)=>r.amount)), `${euro.format(mean(rows.map((r)=>r.amount)))} por movimiento`), kpi("Gasolina", euro.format(sum(rows.filter((r)=>r.category==="Gasolina"),(r)=>r.amount)), "combustible registrado"), kpi("Último gasto", latest?euro.format(latest.amount):"—", latest?new Intl.DateTimeFormat("es-ES",{dateStyle:"medium",timeZone:"UTC"}).format(dateValue(latest.date)):"Sin datos")].join("");
  lineChart($("#vehicle-chart"), [{ values: months.map((m)=>byMonth.get(m)), color: COLORS[1], area: true }], { labels: months.map(labelMonth), currency: true });
  donut($("#vehicle-breakdown"), categories.map((category,index)=>({label:category,value:sum(rows.filter((r)=>r.category===category),(r)=>r.amount),color:COLORS[index%COLORS.length]})), "en el periodo");
  $("#vehicle-table").innerHTML = tableMarkup(["Fecha", "Tipo", "Vehículo", "Descripción", "Precio/l", "Litros", "Días desde anterior", "Importe"], rows.slice().reverse().slice(0,30).map((r)=>[new Intl.DateTimeFormat("es-ES",{dateStyle:"medium",timeZone:"UTC"}).format(dateValue(r.date)),esc(r.category),esc(r.vehicle||"—"),esc(r.description||"—"),r.unit_price ? euro.format(r.unit_price) : "—",r.quantity ? decimal.format(r.quantity) : "—",r.days_since_previous ?? "—",euro.format(r.amount)]), [4,5,6,7]);
}

function renderComparison() {
  const form = new FormData($("#comparison-form"));
  const value = (name) => Math.max(0, Number(form.get(name)) || 0);
  const energy = value("consumption") * value("energy");
  const subtotal = energy + value("fixed") + value("other");
  const taxes = subtotal * value("tax") / 100;
  const total = subtotal + taxes;
  const current = value("current");
  const delta = total - current;
  $("#comparison-result").innerHTML = `<p class="result-label">ESTIMACIÓN MENSUAL</p><div class="result-total">${euro.format(total)}</div><div class="result-change">${current ? `${delta <= 0 ? "Ahorrarías" : "Pagarías"} ${euro.format(Math.abs(delta))} al mes` : "Añade tu factura actual para comparar"}</div><div class="result-breakdown"><div class="result-row"><span>Energía</span><strong>${euro.format(energy)}</strong></div><div class="result-row"><span>Potencia, fijos y otros</span><strong>${euro.format(value("fixed")+value("other"))}</strong></div><div class="result-row"><span>Impuestos</span><strong>${euro.format(taxes)}</strong></div><div class="result-row"><span>Estimación anual</span><strong>${euro.format(total*12)}</strong></div></div><p class="result-note">Estimación orientativa con los datos introducidos. No incluye descuentos ni conceptos no reflejados en el formulario.</p>`;
}

function renderAll() { renderSummary(); renderHistory(); renderLight(); renderFloor(); renderVehicle(); renderComparison(); }

function fillFilters() {
  const properties = [...new Set(state.data.monthly.map((row)=>row.property))];
  $("#property-filter").innerHTML = ["Todas",...properties].map((property)=>`<option ${property === state.property ? "selected" : ""}>${esc(property)}</option>`).join("");
  const years = [...new Set(state.data.monthly.map((row)=>row.month.slice(0,4)))].sort().reverse();
  $("#period-filter").innerHTML = `<option value="all" ${state.period === "all" ? "selected" : ""}>Todo el histórico</option><option value="12m" ${state.period === "12m" ? "selected" : ""}>Últimos 12 meses</option>${years.map((year)=>`<option value="${year}" ${state.period === year ? "selected" : ""}>${year}</option>`).join("")}`;
}

function setupFilters() {
  fillFilters();
  $("#property-filter").addEventListener("change", (event)=>{ state.property=event.target.value; state.page=1; renderAll(); });
  $("#period-filter").addEventListener("change", (event)=>{ state.period=event.target.value; state.page=1; renderAll(); });
}

function activateView(name) {
  $$(".view").forEach((view)=>view.classList.toggle("active", view.id===`view-${name}`));
  $$(".nav-item").forEach((item)=>item.classList.toggle("active",item.dataset.view===name));
  $("#view-eyebrow").textContent=VIEW_COPY[name][0]; $("#view-title").textContent=VIEW_COPY[name][1];
  history.replaceState(null,"",`#${name}`); window.scrollTo({top:0,behavior:"smooth"});
}

function setupEvents() {
  $$("[data-view]").forEach((button)=>button.addEventListener("click",()=>activateView(button.dataset.view)));
  $$("[data-go]").forEach((button)=>button.addEventListener("click",()=>activateView(button.dataset.go)));
  $("#history-search").addEventListener("input",(event)=>{ state.query=event.target.value; state.page=1; renderHistory(); });
  $("#comparison-form").addEventListener("input",renderComparison);
  $("#open-entry").addEventListener("click",()=>{ renderEntryForm(); $("#entry-dialog").showModal(); });
  $("#close-entry").addEventListener("click",()=>$("#entry-dialog").close());
  $("#cancel-entry").addEventListener("click",()=>$("#entry-dialog").close());
  $("#entry-kind").addEventListener("change",renderEntryForm);
  $("#entry-form").addEventListener("input",renderEntryPreview);
  $("#entry-form").addEventListener("submit",saveEntry);
  $("#download-csv").addEventListener("click",()=>{
    const rows=historyRows().slice().reverse();
    const lines=[["Mes","Vivienda",...CATEGORY_ORDER,"Total"],...rows.map((r)=>[r.month,r.property,...CATEGORY_ORDER.map((c)=>r.categories[c]||0),r.total])];
    const csv=lines.map((line)=>line.map((value)=>`"${String(value).replaceAll('"','""')}"`).join(";")).join("\n");
    const link=document.createElement("a"); link.href=URL.createObjectURL(new Blob(["\ufeff",csv],{type:"text/csv;charset=utf-8"})); link.download="historico-facturas.csv"; link.click(); URL.revokeObjectURL(link.href);
  });
  addEventListener("hashchange",()=>{ const name=location.hash.slice(1); if(VIEW_COPY[name]) activateView(name); });
}

async function init() {
  try {
    state.data = await loadData();
    setupFilters(); setupEvents(); renderAll();
    $("#loading").hidden = true;
    const initial = location.hash.slice(1); if (VIEW_COPY[initial]) activateView(initial);
  } catch (error) {
    $("#loading").hidden = true; $("#error").hidden = false; $("#error").textContent = "No se pudieron cargar los datos. Vuelve a intentarlo en unos minutos."; console.error(error);
  }
}

init();
