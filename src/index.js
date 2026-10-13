import fallbackData from "../data/seed.json";

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "public, max-age=120, stale-while-revalidate=600",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

function nestMonthly(rows) {
  return rows.map((row) => ({
    property: row.property,
    month: row.month,
    days: row.days,
    daily_average: row.daily_average,
    total: row.total,
    categories: {
      Alquiler: row.alquiler,
      Luz: row.luz,
      "Calefacción": row.calefaccion,
      Agua: row.agua,
      Internet: row.internet,
      Limpieza: row.limpieza,
    },
  }));
}

async function loadDashboard(db) {
  const [summary, monthly, electricity, floor, vehicle] = await Promise.all([
    db.prepare("SELECT property, category, start_date, end_date, days, daily_average, total FROM facturas_summary ORDER BY id").all(),
    db.prepare("SELECT property, month, days, daily_average, total, alquiler, luz, calefaccion, agua, internet, limpieza FROM facturas_monthly ORDER BY month").all(),
    db.prepare("SELECT property, company, month, start_date, end_date, days, amount, p1, p2, p3, consumption, daily_consumption FROM facturas_electricity ORDER BY month").all(),
    db.prepare("SELECT property, company, month, start_date, end_date, days, amount, cold_kwh, heat_kwh, water_m3, fixed FROM facturas_floor ORDER BY month").all(),
    db.prepare("SELECT date, description, category, vehicle, amount FROM facturas_vehicle ORDER BY date").all(),
  ]);
  return {
    meta: fallbackData.meta,
    summary: summary.results,
    monthly: nestMonthly(monthly.results),
    electricity: electricity.results,
    floor: floor.results,
    vehicle: vehicle.results,
  };
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
    const apiPath = pathname.startsWith("/facturas/")
      ? pathname.slice("/facturas".length)
      : pathname;

    if (apiPath === "/api/health") {
      return json({ ok: true, service: "facturas", storage: "D1" });
    }

    if (apiPath === "/api/dashboard") {
      try {
        return json(await loadDashboard(env.DB));
      } catch (error) {
        console.error("D1 unavailable; serving bundled workbook snapshot", error);
        return json({ ...fallbackData, meta: { ...fallbackData.meta, fallback: true } });
      }
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      return json({ error: "Método no permitido" }, 405);
    }

    return serveAsset(request, env, pathname);
  },
};
