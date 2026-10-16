import { carryForwardZeros } from "./chart-data.js";
import { summarizeVehicleExpenses } from "./vehicle-data.js";

const COLORS = ["#2f6f5d", "#e78466", "#d8a94a", "#6c8ebf", "#9d7bb0", "#8dc9b5"];
const PROPERTY_BAND_COLORS = ["#dceee8", "#f8e3dc", "#f4e9c9", "#dfe8f5", "#e9e0f0", "#dcefeb"];
const CATEGORY_ORDER = ["Alquiler", "Luz", "Calefacción", "Agua", "Internet", "Limpieza"];
const VIEW_COPY = {
  resumen: ["VISIÓN GENERAL", "Tus gastos, con perspectiva"],
  historico: ["HISTÓRICO", "Todos los meses, sin perderte"],
  luz: ["ENERGÍA", "Consumo y gasto de luz"],
  suelo: ["CLIMATIZACIÓN", "Suelo radiante y agua"],
  vehiculo: ["MOVILIDAD", "Gastos del vehículo"],
  comparar: ["SIMULADOR", "Una comparación sencilla"],
};

const state = {
  data: null,
  property: "Todas",
  period: "all",
  page: 1,
  pageSize: 12,
  query: "",
  editingEntryId: null,
  editingSourceId: null,
  chartCategory: "Total",
  chartMetric: "absolute",
  vehicleSummaryPeriod: "monthly",
  timelines: {
    summary: { window: 12, end: null },
    light: { window: 12, end: null },
    floor: { window: 12, end: null },
  },
};
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
const SIMPLE_ENTRY_TYPES = new Set(["Alquiler", "Agua", "Limpieza", "Internet"]);

function shiftMonth(value, amount = 1) {
  if (!value) return today();
  const source = dateValue(value);
  const day = source.getUTCDate();
  const target = new Date(Date.UTC(source.getUTCFullYear(), source.getUTCMonth() + amount, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
}

function propertyInput() {
  const properties = [...new Set(state.data.monthly.map((row) => row.property))];
  const selected = state.property !== "Todas" ? state.property : properties.at(-1) || "";
  return `<label class="form-field">Vivienda<input name="property" list="property-list" required value="${esc(selected)}" /></label><datalist id="property-list">${properties.map((property) => `<option value="${esc(property)}"></option>`).join("")}</datalist>`;
}

function moneyField(name, label, value = "") {
  return `<label class="form-field">${label}<input name="${name}" type="number" min="0" step="0.01" ${value !== "" ? `value="${value}"` : ""} required /></label>`;
}

function entryFieldsMarkup(type) {
  const date = today();
  if (SIMPLE_ENTRY_TYPES.has(type)) return `${propertyInput()}<label class="form-field">Fecha de inicio<input name="start_date" type="date" value="${date}" required /></label><label class="form-field">Fecha de fin<input name="end_date" type="date" value="${date}" required /></label>${moneyField("amount", "Importe total (€)")}`;
  if (type === "electricity") return `${propertyInput()}<label class="form-field">Compañía<input name="company" required /></label><label class="form-field">Fecha de inicio<input name="start_date" type="date" value="${date}" required /></label><label class="form-field">Fecha de fin<input name="end_date" type="date" value="${date}" required /></label>${moneyField("amount", "Importe total (€)")}${moneyField("p1", "Consumo P1 (kWh)", 0)}${moneyField("p2", "Consumo P2 (kWh)", 0)}${moneyField("p3", "Consumo P3 (kWh)", 0)}`;
  if (type === "floor") return `${propertyInput()}<label class="form-field">Compañía<input name="company" required /></label><label class="form-field">Fecha de inicio<input name="start_date" type="date" value="${date}" required /></label><label class="form-field">Fecha de fin<input name="end_date" type="date" value="${date}" required /></label>${moneyField("cold_kwh", "Consumo frío (kWh)", 0)}${moneyField("cold_price", "Precio frío (€/kWh)", 0)}${moneyField("heat_kwh", "Consumo calor (kWh)", 0)}${moneyField("heat_price", "Precio calor (€/kWh)", 0)}${moneyField("water_m3", "Consumo agua (m³)", 0)}${moneyField("water_price", "Precio agua (€/m³)", 0)}${moneyField("fixed", "Cuota fija (€)", 0)}<label class="form-field">IVA (%)<input name="vat_rate" type="number" min="0" step="0.1" value="21" required /></label>`;
  return `<label class="form-field">Fecha<input name="date" type="date" value="${date}" required /></label><label class="form-field">Categoría<select name="category"><option>Gasolina</option><option>Ad Blue</option><option>Seguro</option><option>Taller</option><option>Impuestos</option><option>Otros</option></select></label><label class="form-field">Vehículo<input name="vehicle" placeholder="Coche, moto…" /></label><label class="form-field">Descripción<input name="description" /></label>${moneyField("amount", "Importe total (€)")}<label class="form-field">Precio por litro (€)<input name="unit_price" type="number" min="0" step="0.001" /></label>`;
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
  if (SIMPLE_ENTRY_TYPES.has(values.entry_type)) lines = [["Días del periodo", days || "—"], ["Gasto diario", days ? euro.format(n("amount") / days) : "—"], ["Reparto mensual", "Automático según los días de cada mes"]];
  if (values.entry_type === "electricity") {
    const consumption = n("p1") + n("p2") + n("p3");
    lines = [["Días", days || "—"], ["Consumo total", `${decimal.format(consumption)} kWh`], ["Consumo diario", days ? `${decimal.format(consumption / days)} kWh` : "—"], ["Coste por kWh", consumption ? euro.format(n("amount") / consumption) : "—"]];
  }
  if (values.entry_type === "floor") {
    const cold = n("cold_kwh") * n("cold_price"), heat = n("heat_kwh") * n("heat_price"), water = n("water_m3") * n("water_price");
    const total = (cold + heat + water + n("fixed")) * (1 + n("vat_rate") / 100);
    lines = [["Frío", euro.format(cold)], ["Calor", euro.format(heat)], ["Agua", euro.format(water)], ["Factura calculada", euro.format(total)], ["Importe diario", days ? euro.format(total / days) : "—"]];
  }
  if (values.entry_type === "vehicle") lines = [["Cantidad calculada", n("unit_price") ? `${decimal.format(n("amount") / n("unit_price"))} l` : "Añade el precio/litro"], ["Resumen", "Se agrega al mes, año y categoría"]];
  $("#entry-preview").innerHTML = `<strong>Cálculos automáticos</strong>${lines.map(([label, value]) => `<span><small>${label}</small><b>${value}</b></span>`).join("")}`;
}

function renderEntryForm() {
  const type = $("#entry-kind").value;
  const editing = Boolean(state.editingEntryId || state.editingSourceId);
  $("#entry-fields").innerHTML = entryFieldsMarkup(type);
  $("#entry-message").hidden = true;
  $("#entry-kicker").textContent = editing ? "CORREGIR REGISTRO" : "NUEVO REGISTRO";
  $("#entry-title").textContent = editing ? "Editar dato" : "Añadir datos";
  $("#save-entry").textContent = editing ? "Guardar cambios" : "Guardar y recalcular";
  $("#copy-last-entry").hidden = editing;
  renderEntryPreview();
}

function setEntryField(name, value) {
  const field = $(`#entry-fields [name="${name}"]`);
  if (field && value !== undefined && value !== null) field.value = value;
}

function showEntryMessage(message, error = false) {
  const box = $("#entry-message");
  box.textContent = message;
  box.classList.toggle("success", !error);
  box.hidden = false;
}

function copyLastEntry() {
  const type = $("#entry-kind").value;
  const property = $(`#entry-fields [name="property"]`)?.value;
  let source;
  if (SIMPLE_ENTRY_TYPES.has(type)) {
    source = state.data.invoices.slice().reverse().find((row) => (!property || row.property === property) && row.category === type);
    if (source) {
      setEntryField("start_date", shiftMonth(source.start_date));
      setEntryField("end_date", shiftMonth(source.end_date));
      setEntryField("amount", source.total);
    }
  } else if (type === "electricity") {
    source = state.data.electricity.slice().reverse().find((row) => !property || row.property === property);
    if (source) {
      ["company", "amount", "p1", "p2", "p3"].forEach((name) => setEntryField(name, source[name]));
      setEntryField("start_date", shiftMonth(source.start_date || source.month));
      setEntryField("end_date", shiftMonth(source.end_date || source.month));
    }
  } else if (type === "floor") {
    source = state.data.floor.slice().reverse().find((row) => !property || row.property === property);
    if (source) {
      ["company", "cold_kwh", "cold_price", "heat_kwh", "heat_price", "water_m3", "water_price", "fixed", "vat_rate"].forEach((name) => setEntryField(name, source[name]));
      setEntryField("start_date", shiftMonth(source.start_date || source.month));
      setEntryField("end_date", shiftMonth(source.end_date || source.month));
    }
  } else {
    source = state.data.vehicle.at(-1);
    if (source) {
      ["category", "vehicle", "description", "amount", "unit_price"].forEach((name) => setEntryField(name, source[name]));
      setEntryField("date", shiftMonth(source.date));
    }
  }
  if (!source) return showEntryMessage("No hay un registro anterior de este tipo para copiar.", true);
  showEntryMessage("Último registro copiado. Revisa las fechas y guarda cuando esté listo.");
  renderEntryPreview();
}

function beginEditEntry(id) {
  const entry = (state.data.entries || []).find((item) => item.id === id);
  if (!entry) return;
  state.editingEntryId = id;
  state.editingSourceId = null;
  const type = entry.kind === "home" ? entry.payload.category : entry.kind;
  $("#entry-kind").value = type;
  renderEntryForm();
  Object.entries(entry.payload).forEach(([name, value]) => setEntryField(name, value));
  renderEntryPreview();
  $("#entry-dialog").showModal();
}

function beginEditSourceVehicle(sourceId) {
  const entry = state.data.vehicle.find((item) => item.source_id === sourceId);
  if (!entry) return;
  state.editingEntryId = null;
  state.editingSourceId = sourceId;
  $("#entry-kind").value = "vehicle";
  renderEntryForm();
  ["date", "category", "vehicle", "description", "amount", "unit_price"].forEach((name) => setEntryField(name, entry[name]));
  renderEntryPreview();
  $("#entry-dialog").showModal();
}

async function saveEntry(event) {
  event.preventDefault();
  const values = entryValues();
  const type = values.entry_type;
  const kind = SIMPLE_ENTRY_TYPES.has(type) ? "home" : type;
  if (SIMPLE_ENTRY_TYPES.has(type)) values.category = type;
  delete values.entry_type;
  const editingId = state.editingEntryId;
  const sourceId = state.editingSourceId;
  const button = $("#save-entry");
  button.disabled = true;
  button.textContent = "Guardando…";
  const base = location.pathname.startsWith("/facturas") ? "/facturas" : "";
  try {
    const endpoint = sourceId ? `${base}/api/source-records/${encodeURIComponent(sourceId)}` : `${base}/api/entries${editingId ? `/${editingId}` : ""}`;
    const response = await fetch(endpoint, { method: editingId || sourceId ? "PUT" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind, payload: values }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "No se pudo guardar");
    state.data = await loadData();
    fillFilters();
    renderAll();
    $("#entry-dialog").close();
    state.editingEntryId = null;
    state.editingSourceId = null;
  } catch (error) {
    $("#entry-message").textContent = error.message;
    $("#entry-message").hidden = false;
  } finally {
    button.disabled = false;
    button.textContent = state.editingEntryId || state.editingSourceId ? "Guardar cambios" : "Guardar y recalcular";
  }
}

async function deleteRecord({ entryId = null, sourceId = null } = {}) {
  if (!entryId && !sourceId) return;
  if (!confirm("¿Eliminar este registro? Dejará de aparecer en los totales y gráficas.")) return;
  const base = location.pathname.startsWith("/facturas") ? "/facturas" : "";
  const endpoint = sourceId ? `${base}/api/source-records/${encodeURIComponent(sourceId)}` : `${base}/api/entries/${entryId}`;
  try {
    const response = await fetch(endpoint, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: sourceId ? JSON.stringify({ kind: "vehicle" }) : undefined,
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "No se pudo eliminar");
    state.data = await loadData();
    fillFilters();
    renderAll();
  } catch (error) {
    alert(error.message);
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

function timelineSlice(rows, key) {
  const config = state.timelines[key];
  if (!rows.length) return [];
  const size = config.window === "all" ? rows.length : Math.min(Number(config.window), rows.length);
  const end = Math.max(size - 1, Math.min(config.end ?? rows.length - 1, rows.length - 1));
  const start = Math.max(0, end - size + 1);
  return rows.slice(start, end + 1);
}

function renderTimeline(container, rows, key, rerender) {
  if (!container) return;
  if (!rows.length) { container.innerHTML = ""; return; }
  const config = state.timelines[key];
  const visible = timelineSlice(rows, key);
  const end = rows.indexOf(visible.at(-1));
  const minimumEnd = visible.length - 1;
  const first = visible.at(0);
  const last = visible.at(-1);
  container.innerHTML = `<div class="timeline-heading"><div><strong>Periodo visible</strong><span>${labelMonth(first.month, true)} — ${labelMonth(last.month, true)}</span></div><div class="timeline-windows">${[[6,"6 m"],[12,"12 m"],[24,"24 m"],["all","Todo"]].map(([value,label]) => `<button type="button" data-window="${value}" class="${String(config.window) === String(value) ? "active" : ""}">${label}</button>`).join("")}</div></div><input class="timeline-range" type="range" min="${minimumEnd}" max="${rows.length - 1}" value="${end}" step="1" aria-label="Desplazar el periodo visible" ${rows.length <= visible.length ? "disabled" : ""}/><div class="timeline-ends"><span>${labelMonth(rows[0].month)}</span><span>${labelMonth(rows.at(-1).month)}</span></div>`;
  container.querySelector(".timeline-range")?.addEventListener("input", (event) => {
    config.end = Number(event.target.value);
    const selected = timelineSlice(rows, key);
    container.querySelector(".timeline-heading span").textContent = `${labelMonth(selected.at(0).month, true)} — ${labelMonth(selected.at(-1).month, true)}`;
    rerender(false);
  });
  container.querySelectorAll("[data-window]").forEach((button) => button.addEventListener("click", () => {
    config.window = button.dataset.window === "all" ? "all" : Number(button.dataset.window);
    rerender();
  }));
}

function propertyBands(rows) {
  const propertyOrder = [...new Set(state.data.monthly.map((row) => row.property))];
  const bands = [];
  rows.forEach((row, index) => {
    const previous = bands.at(-1);
    if (previous?.label === row.property) previous.end = index;
    else bands.push({
      start: index,
      end: index,
      label: row.property,
      color: PROPERTY_BAND_COLORS[Math.max(0, propertyOrder.indexOf(row.property)) % PROPERTY_BAND_COLORS.length],
    });
  });
  return bands;
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
  const bands = (options.bands || []).map((band) => {
    const left = band.start <= 0 ? pad.left : (x(band.start - 1) + x(band.start)) / 2;
    const right = band.end >= length - 1 ? width - pad.right : (x(band.end) + x(band.end + 1)) / 2;
    const bandWidth = Math.max(0, right - left);
    const label = bandWidth >= 74 ? `<text class="chart-property-label" x="${left + bandWidth / 2}" y="${pad.top + 13}" text-anchor="middle">${esc(band.label)}</text>` : "";
    return `<g class="chart-property-band"><rect x="${left}" y="${pad.top}" width="${bandWidth}" height="${height-pad.top-pad.bottom}" rx="4" fill="${band.color}"/>${label}</g>`;
  }).join("");
  const drawings = usable.map((item, seriesIndex) => {
    const color = item.color || COLORS[seriesIndex];
    const points = item.values.map((value, index) => `${x(index)},${y(Number(value) || 0)}`).join(" ");
    const area = item.area ? `<polygon class="chart-area" fill="${color}" points="${pad.left},${height-pad.bottom} ${points} ${x(item.values.length-1)},${height-pad.bottom}"/>` : "";
    return `${area}<polyline class="chart-line" stroke="${color}" points="${points}"/>`;
  }).join("");
  const marker = `<g class="chart-marker"><line class="chart-marker-line" x1="0" y1="${pad.top}" x2="0" y2="${height-pad.bottom}"/>${usable.map((item, index) => `<circle class="chart-marker-halo" data-marker="${index}" r="13" fill="${item.color || COLORS[index]}"/><circle class="chart-marker-dot" data-marker="${index}" r="6" fill="${item.color || COLORS[index]}"/>`).join("")}</g>`;
  container.innerHTML = `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">${bands}${grid}${xLabels}${drawings}${marker}</svg><div class="chart-tooltip" aria-live="polite"></div>`;
  const svg = container.querySelector("svg");
  const tooltip = container.querySelector(".chart-tooltip");
  const formatValue = (value) => options.currency ? euro.format(value) : decimal.format(value);
  const showIndex = (index) => {
    const safeIndex = Math.max(0, Math.min(length - 1, index));
    const px = x(safeIndex);
    const markerLine = svg.querySelector(".chart-marker-line");
    markerLine.setAttribute("x1", px); markerLine.setAttribute("x2", px);
    usable.forEach((item, seriesIndex) => {
      const value = Number(item.values[safeIndex]) || 0;
      svg.querySelectorAll(`[data-marker="${seriesIndex}"]`).forEach((circle) => {
        circle.setAttribute("cx", px);
        circle.setAttribute("cy", y(value));
      });
    });
    const label = labels[safeIndex] || `Dato ${safeIndex + 1}`;
    const context = options.context?.[safeIndex];
    tooltip.innerHTML = `<strong>${esc(label)}</strong>${context ? `<small>${esc(context)}</small>` : ""}${usable.map((item, seriesIndex) => `<span><i style="background:${item.color || COLORS[seriesIndex]}"></i>${esc(item.label || "Valor")}: <b>${formatValue(Number(item.values[safeIndex]) || 0)}</b></span>`).join("")}`;
  };
  const selectFromPointer = (event) => {
    const rect = svg.getBoundingClientRect();
    const viewX = ((event.clientX - rect.left) / Math.max(rect.width, 1)) * width;
    const index = length <= 1 ? 0 : Math.round(((viewX - pad.left) / (width - pad.left - pad.right)) * (length - 1));
    showIndex(index);
  };
  svg.addEventListener("pointermove", selectFromPointer);
  svg.addEventListener("pointerdown", selectFromPointer);
  showIndex(length - 1);
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

function renderSummary(refreshTimeline = true) {
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
  const category = state.chartCategory;
  const dailyMetric = state.chartMetric === "daily";
  const rawValues = rows.map((row) => {
    const amount = category === "Total" ? row.total : Number(row.categories[category]) || 0;
    return dailyMetric ? (category === "Total" ? Number(row.daily_average) || 0 : Number(row.category_daily?.[category]) || 0) : amount;
  });
  const chartRows = timelineSlice(rows, "summary");
  const firstChartIndex = chartRows.length ? rows.indexOf(chartRows[0]) : 0;
  const values = (category === "Total" ? rawValues : carryForwardZeros(rawValues)).slice(firstChartIndex, firstChartIndex + chartRows.length);
  const metricLabel = dailyMetric ? "Gasto diario" : "Importe mensual";
  $("#monthly-chart-title").textContent = `${metricLabel} · ${category}`;
  lineChart($("#monthly-chart"), [{ label: category, values, color: COLORS[Math.max(0, CATEGORY_ORDER.indexOf(category))] || COLORS[0], area: true }], {
    labels: chartRows.map((row) => labelMonth(row.month)),
    currency: true,
    bands: state.property === "Todas" ? propertyBands(chartRows) : [],
    context: state.property === "Todas" ? chartRows.map((row) => row.property) : [],
  });
  if (refreshTimeline) renderTimeline($("#summary-timeline"), rows, "summary", renderSummary);
  const categoryItems = CATEGORY_ORDER.map((category, index) => ({ label: category, value: sum(rows, (row) => row.categories[category]), color: COLORS[index] }));
  donut($("#category-chart"), categoryItems, "en el periodo");
  const recent = rows.slice(-5).reverse();
  $("#recent-table").innerHTML = tableMarkup(["Mes", "Vivienda", "Total", "€/día", "Peso"], recent.map((row) => [labelMonth(row.month, true), row.property, euro.format(row.total), euro.format(row.daily_average), `<div class="microbar"><span style="width:${Math.min(100, row.total/Math.max(...recent.map((r)=>r.total),1)*100)}%"></span></div>`]), [2,3]);
}

function tableMarkup(headers, rows, numericColumns = []) {
  if (!rows.length) return `<div class="empty">No hay datos para este filtro.</div>`;
  return `<table><thead><tr>${headers.map((header, index) => `<th class="${numericColumns.includes(index) ? "number" : ""}">${esc(header)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell, index) => `<td class="${numericColumns.includes(index) ? "number" : ""}">${cell ?? "—"}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
}

function shortDate(value, includeYear = false) {
  return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", ...(includeYear ? { year: "2-digit" } : {}), timeZone: "UTC" }).format(dateValue(value)).replaceAll(" ", " ");
}

function fullPeriod(row) {
  return `${shortDate(row.start_date, true)}–${shortDate(row.end_date, true)}`;
}

function monthlyCategoryCell(row, category) {
  const details = row.category_details?.[category] || [];
  if (!details.length) return `<span class="empty-amount">—</span>`;
  return `<span class="invoice-stack">${details.map((detail) => {
    const differentYear = detail.start_date.slice(0, 4) !== detail.end_date.slice(0, 4);
    return `<span class="invoice-cell"><strong>${euro.format(detail.total)}</strong><small>${euro.format(detail.daily_average)}/día · ${detail.days} días</small><small>${shortDate(detail.start_date, differentYear)}–${shortDate(detail.end_date, differentYear)}</small></span>`;
  }).join("")}</span>`;
}

function historyRows() {
  const query = state.query.toLocaleLowerCase("es");
  return filteredMonthly().filter((row) => !query || `${row.property} ${labelMonth(row.month, true)} ${row.start_date || ""} ${row.end_date || ""}`.toLocaleLowerCase("es").includes(query)).slice().reverse();
}

function renderHistory() {
  const rows = historyRows();
  const pages = Math.max(1, Math.ceil(rows.length / state.pageSize));
  state.page = Math.min(state.page, pages);
  const visible = rows.slice((state.page - 1) * state.pageSize, state.page * state.pageSize);
  $("#history-table").innerHTML = tableMarkup(["Mes de inicio", "Vivienda", ...CATEGORY_ORDER, "Total"], visible.map((row) => [
    `<strong>${labelMonth(row.month, true)}</strong>`,
    esc(row.property),
    ...CATEGORY_ORDER.map((category) => monthlyCategoryCell(row, category)),
    `<strong>${euro.format(row.total)}</strong>`,
  ]), [2,3,4,5,6,7,8]);
  $("#history-pagination").innerHTML = `<span>${rows.length ? (state.page-1)*state.pageSize+1 : 0}–${Math.min(state.page*state.pageSize,rows.length)} de ${rows.length}</span><div class="pagination-buttons"><button data-page="${state.page-1}" ${state.page===1?"disabled":""}>‹</button><button disabled>${state.page}</button><button data-page="${state.page+1}" ${state.page===pages?"disabled":""}>›</button></div>`;
  $$("#history-pagination [data-page]").forEach((button) => button.addEventListener("click", () => { state.page = Number(button.dataset.page); renderHistory(); }));
  renderEditableEntries();
}

function editableEntryAmount(entry) {
  const payload = entry.payload || {};
  if (entry.kind !== "floor") return Number(payload.amount) || 0;
  const subtotal = (Number(payload.cold_kwh) || 0) * (Number(payload.cold_price) || 0)
    + (Number(payload.heat_kwh) || 0) * (Number(payload.heat_price) || 0)
    + (Number(payload.water_m3) || 0) * (Number(payload.water_price) || 0)
    + (Number(payload.fixed) || 0);
  return subtotal * (1 + (Number(payload.vat_rate) || 0) / 100);
}

function entryTypeLabel(entry) {
  if (entry.kind === "home") return entry.payload.category || "Vivienda";
  if (entry.kind === "electricity") return "Luz";
  if (entry.kind === "floor") return "Calefacción";
  return entry.payload.category || "Vehículo";
}

function entryPeriodLabel(payload) {
  const format = (value) => value ? new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeZone: "UTC" }).format(dateValue(value)) : "—";
  if (payload.start_date || payload.end_date) return `${format(payload.start_date)} — ${format(payload.end_date)}`;
  return format(payload.date);
}

function renderEditableEntries() {
  const entries = (state.data.entries || []).slice().reverse();
  if (!entries.length) {
    $("#entries-table").innerHTML = `<div class="empty">Todavía no hay datos añadidos desde la aplicación.</div>`;
    return;
  }
  $("#entries-table").innerHTML = tableMarkup(["Tipo", "Periodo", "Vivienda / detalle", "Importe", "Acción"], entries.map((entry) => {
    const payload = entry.payload || {};
    const detail = payload.property || [payload.vehicle, payload.description].filter(Boolean).join(" · ") || "—";
    return [esc(entryTypeLabel(entry)), entryPeriodLabel(payload), esc(detail), euro.format(editableEntryAmount(entry)), `<div class="record-actions"><button class="edit-entry-button" type="button" data-edit-entry="${entry.id}">Editar</button><button class="delete-entry-button" type="button" data-delete-entry="${entry.id}">Eliminar</button></div>`];
  }), [3]);
  $$("#entries-table [data-edit-entry]").forEach((button) => button.addEventListener("click", () => beginEditEntry(Number(button.dataset.editEntry))));
  $$("#entries-table [data-delete-entry]").forEach((button) => button.addEventListener("click", () => deleteRecord({ entryId: Number(button.dataset.deleteEntry) })));
}

function renderLight(refreshTimeline = true) {
  const rows = filterByGlobalPeriod(state.data.electricity);
  const consumption = sum(rows, (row) => row.consumption);
  const latest = rows.at(-1);
  $("#light-kpis").innerHTML = [kpi("Facturas", rows.length, "periodos registrados", true), kpi("Gasto", euro.format(sum(rows, (r) => r.amount)), `${euro.format(mean(rows.map((r)=>r.amount)))} de media`), kpi("Consumo", `${decimal.format(consumption)} kWh`, `${decimal.format(mean(rows.map((r)=>r.daily_consumption)))} kWh/día`), kpi("Última compañía", latest?.company || "—", latest ? labelMonth(latest.month, true) : "Sin datos")].join("");
  const chartRows = timelineSlice(rows, "light");
  lineChart($("#light-cost-chart"), [{ label: "Importe", values: chartRows.map((r)=>r.amount), color: COLORS[0], area: true }], { labels: chartRows.map((r)=>labelMonth(r.month)), currency: true });
  lineChart($("#light-use-chart"), [{ label: "P1", values: chartRows.map((r)=>r.p1), color: COLORS[1] }, { label: "P2", values: chartRows.map((r)=>r.p2), color: COLORS[2] }, { label: "P3", values: chartRows.map((r)=>r.p3), color: COLORS[3] }], { labels: chartRows.map((r)=>labelMonth(r.month)) });
  if (refreshTimeline) renderTimeline($("#light-timeline"), rows, "light", renderLight);
  $("#light-table").innerHTML = tableMarkup(["Periodo real", "Vivienda", "Compañía", "Días", "€/día", "P1", "P2", "P3", "Total kWh", "kWh/día", "€/kWh", "Importe"], rows.slice().reverse().slice(0, 24).map((r)=>[fullPeriod(r),esc(r.property),esc(r.company),r.days,euro.format(r.daily_amount),decimal.format(r.p1),decimal.format(r.p2),decimal.format(r.p3),`<strong>${decimal.format(r.consumption)}</strong>`,decimal.format(r.daily_consumption),r.cost_per_kwh ? euro.format(r.cost_per_kwh) : "—",euro.format(r.amount)]), [3,4,5,6,7,8,9,10,11]);
}

function renderFloor(refreshTimeline = true) {
  const rows = filterByGlobalPeriod(state.data.floor);
  const latest = rows.at(-1);
  $("#floor-kpis").innerHTML = [kpi("Facturas", rows.length, "periodos registrados", true), kpi("Gasto", euro.format(sum(rows,(r)=>r.amount)), `${euro.format(mean(rows.map((r)=>r.amount)))} de media`), kpi("Energía", `${decimal.format(sum(rows,(r)=>r.cold_kwh+r.heat_kwh))} kWh`, "frío y calor"), kpi("Última compañía", latest?.company || "—", latest ? labelMonth(latest.month,true) : "Sin datos")].join("");
  const chartRows = timelineSlice(rows, "floor");
  lineChart($("#floor-cost-chart"), [{ label: "Importe", values: chartRows.map((r)=>r.amount), color: COLORS[0], area: true }], { labels: chartRows.map((r)=>labelMonth(r.month)), currency: true });
  lineChart($("#floor-use-chart"), [{ label: "Frío", values: chartRows.map((r)=>r.cold_kwh), color: COLORS[3] }, { label: "Calor", values: chartRows.map((r)=>r.heat_kwh), color: COLORS[1] }, { label: "Agua ×50", values: chartRows.map((r)=>r.water_m3*50), color: COLORS[0] }], { labels: chartRows.map((r)=>labelMonth(r.month)) });
  if (refreshTimeline) renderTimeline($("#floor-timeline"), rows, "floor", renderFloor);
  $("#floor-table").innerHTML = tableMarkup(["Periodo real", "Compañía", "Días", "Frío kWh", "Calor kWh", "Agua m³", "Fijo", "€/día", "Importe"], rows.slice().reverse().map((r)=>[fullPeriod(r),esc(r.company),r.days,decimal.format(r.cold_kwh),decimal.format(r.heat_kwh),decimal.format(r.water_m3),euro.format(r.fixed),euro.format(r.daily_amount),euro.format(r.amount)]), [2,3,4,5,6,7,8]);
}

function renderVehicle() {
  const rows = filterByGlobalPeriod(state.data.vehicle, "date");
  const monthly = summarizeVehicleExpenses(rows, 7);
  const annual = summarizeVehicleExpenses(rows, 4);
  const latest = rows.at(-1);
  $("#vehicle-kpis").innerHTML = [kpi("Movimientos", rows.length, "gastos registrados", true), kpi("Gasto total", euro.format(sum(rows,(r)=>r.amount)), `${euro.format(mean(rows.map((r)=>r.amount)))} por movimiento`), kpi("Gasolina", euro.format(sum(rows.filter((r)=>r.category==="Gasolina"),(r)=>r.amount)), "combustible registrado"), kpi("Último gasto", latest?euro.format(latest.amount):"—", latest?new Intl.DateTimeFormat("es-ES",{dateStyle:"medium",timeZone:"UTC"}).format(dateValue(latest.date)):"Sin datos")].join("");
  lineChart($("#vehicle-chart"), [{ label: "Importe", values: monthly.map((item)=>item.total), color: COLORS[1], area: true }], { labels: monthly.map((item)=>labelMonth(`${item.key}-01`)), currency: true });
  const annualMode = state.vehicleSummaryPeriod === "annual";
  $("#vehicle-summary-period").value = state.vehicleSummaryPeriod;
  $("#vehicle-summary-title").textContent = annualMode ? "Gasto por año" : "Gasto por mes";
  $("#vehicle-summary-copy").textContent = annualMode ? "Total anual y media de los meses con movimientos." : "Importe y movimientos registrados en cada mes.";
  $("#vehicle-summary").innerHTML = annualMode
    ? tableMarkup(["Año", "Movimientos", "Total", "Media mensual"], annual.slice().reverse().map((item)=>[item.key, item.count, euro.format(item.total), euro.format(item.total/Math.max(1, monthly.filter((month)=>month.key.startsWith(item.key)).length))]), [1,2,3])
    : tableMarkup(["Mes", "Movimientos", "Total", "Media"], monthly.slice().reverse().map((item)=>[labelMonth(`${item.key}-01`, true), item.count, euro.format(item.total), euro.format(item.total/item.count)]), [1,2,3]);
  $("#vehicle-table").innerHTML = tableMarkup(["Fecha", "Tipo", "Vehículo", "Descripción", "Precio/l", "Litros", "Días desde anterior", "Importe", "Acción"], rows.slice().reverse().map((r)=>[new Intl.DateTimeFormat("es-ES",{dateStyle:"medium",timeZone:"UTC"}).format(dateValue(r.date)),esc(r.category),esc(r.vehicle||"—"),esc(r.description||"—"),r.unit_price ? euro.format(r.unit_price) : "—",r.quantity ? decimal.format(r.quantity) : "—",r.days_since_previous ?? "—",euro.format(r.amount),r.entry_id ? `<div class="record-actions"><button class="edit-entry-button" type="button" data-edit-entry="${r.entry_id}">Editar</button><button class="delete-entry-button" type="button" data-delete-entry="${r.entry_id}">Eliminar</button></div>` : `<div class="record-actions"><button class="edit-entry-button" type="button" data-edit-source="${esc(r.source_id)}">Editar</button><button class="delete-entry-button" type="button" data-delete-source="${esc(r.source_id)}">Eliminar</button></div>`]), [4,5,6,7]);
  $$("#vehicle-table [data-edit-entry]").forEach((button) => button.addEventListener("click", () => beginEditEntry(Number(button.dataset.editEntry))));
  $$("#vehicle-table [data-delete-entry]").forEach((button) => button.addEventListener("click", () => deleteRecord({ entryId: Number(button.dataset.deleteEntry) })));
  $$("#vehicle-table [data-edit-source]").forEach((button) => button.addEventListener("click", () => beginEditSourceVehicle(button.dataset.editSource)));
  $$("#vehicle-table [data-delete-source]").forEach((button) => button.addEventListener("click", () => deleteRecord({ sourceId: button.dataset.deleteSource })));
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
  $("#property-filter").addEventListener("change", (event)=>{ state.property=event.target.value; state.page=1; state.timelines.summary.end=null; state.timelines.light.end=null; state.timelines.floor.end=null; renderAll(); });
  $("#period-filter").addEventListener("change", (event)=>{ state.period=event.target.value; state.page=1; state.timelines.summary.end=null; state.timelines.light.end=null; state.timelines.floor.end=null; renderAll(); });
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
  $("#open-entry").addEventListener("click",()=>{ state.editingEntryId=null; state.editingSourceId=null; renderEntryForm(); $("#entry-dialog").showModal(); });
  $("#close-entry").addEventListener("click",()=>{ state.editingEntryId=null; state.editingSourceId=null; $("#entry-dialog").close(); });
  $("#cancel-entry").addEventListener("click",()=>{ state.editingEntryId=null; state.editingSourceId=null; $("#entry-dialog").close(); });
  $("#entry-kind").addEventListener("change",renderEntryForm);
  $("#copy-last-entry").addEventListener("click",copyLastEntry);
  $("#entry-form").addEventListener("input",renderEntryPreview);
  $("#entry-form").addEventListener("submit",saveEntry);
  $("#chart-category").addEventListener("change",(event)=>{ state.chartCategory=event.target.value; renderSummary(); });
  $("#chart-metric").addEventListener("change",(event)=>{ state.chartMetric=event.target.value; renderSummary(); });
  $("#vehicle-summary-period").addEventListener("change",(event)=>{ state.vehicleSummaryPeriod=event.target.value; renderVehicle(); });
  $("#download-csv").addEventListener("click",()=>{
    const rows=historyRows().slice().reverse();
    const lines=[["Mes de inicio","Vivienda",...CATEGORY_ORDER.flatMap((category)=>[category,`${category} €/día`]),"Total","Gasto diario total"],...rows.map((r)=>[r.month,r.property,...CATEGORY_ORDER.flatMap((c)=>[r.categories[c]||0,r.category_daily?.[c]||0]),r.total,r.daily_average])];
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
