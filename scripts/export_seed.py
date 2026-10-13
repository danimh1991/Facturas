import datetime as dt
import json
import math
import pathlib
import re

import openpyxl


SOURCE = pathlib.Path(r"\\Danieta_Nas\Danieta\Casa\Facturas.xlsx")
ROOT = pathlib.Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "data" / "seed.json"
PUBLIC_DATA_PATH = ROOT / "public" / "facturas" / "data.json"
MIGRATION_PATH = ROOT / "migrations" / "0001_facturas.sql"


def clean_text(value):
    if value is None:
        return None
    return str(value).replace("�", "ó").strip()


def number(value):
    if isinstance(value, (int, float)) and math.isfinite(value):
        return round(float(value), 6)
    return None


def iso_date(value):
    if isinstance(value, (dt.datetime, dt.date)):
        return value.date().isoformat() if isinstance(value, dt.datetime) else value.isoformat()
    if not value:
        return None
    text = str(value).strip()
    match = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{4})$", text)
    if match:
        day, month, year = map(int, match.groups())
        return dt.date(year, month, day).isoformat()
    try:
        return dt.datetime.fromisoformat(text).date().isoformat()
    except ValueError:
        return None


book = openpyxl.load_workbook(SOURCE, data_only=True, read_only=False)

summary = []
sheet = book["Resumen Hist"]
property_name = "Total"
for row in range(1, sheet.max_row + 1):
    label = clean_text(sheet.cell(row, 1).value)
    if not label:
        continue
    if sheet.cell(row, 2).value == "Inicio":
        property_name = label.rsplit(" - ", 1)[0]
        continue
    summary.append(
        {
            "property": property_name,
            "category": label,
            "start_date": iso_date(sheet.cell(row, 2).value),
            "end_date": iso_date(sheet.cell(row, 3).value),
            "days": int(sheet.cell(row, 4).value or 0),
            "daily_average": number(sheet.cell(row, 5).value),
            "total": number(sheet.cell(row, 6).value),
        }
    )

monthly = []
sheet = book["Facturas"]
property_name = None
for row in range(3, 116):
    house = clean_text(sheet.cell(row, 2).value)
    if house and house != "Total":
        property_name = house
    if house == "Total" or not property_name:
        continue
    month = iso_date(sheet.cell(row, 36).value)
    days = number(sheet.cell(row, 38).value)
    total = number(sheet.cell(row, 40).value)
    if not month or not days or total is None:
        continue
    category_amounts = {
        "Alquiler": number(sheet.cell(row, 7).value) or 0,
        "Luz": round((number(sheet.cell(row, 42).value) or 0) * days, 6),
        "Calefacción": round((number(sheet.cell(row, 43).value) or 0) * days, 6),
        "Agua": round((number(sheet.cell(row, 44).value) or 0) * days, 6),
        "Internet": number(sheet.cell(row, 30).value) or 0,
        "Limpieza": number(sheet.cell(row, 35).value) or 0,
    }
    raw_category_total = sum(category_amounts.values())
    if raw_category_total and abs(raw_category_total - total) > 0.01:
        category_amounts = {
            category: round(amount * total / raw_category_total, 6)
            for category, amount in category_amounts.items()
        }
    monthly.append(
        {
            "property": property_name,
            "month": month[:7] + "-01",
            "days": int(days),
            "daily_average": number(sheet.cell(row, 39).value),
            "total": total,
            "categories": category_amounts,
        }
    )

electricity = []
sheet = book["Consumo Luz"]
for row in range(2, sheet.max_row + 1):
    month = iso_date(sheet.cell(row, 3).value)
    if not month:
        continue
    electricity.append(
        {
            "property": clean_text(sheet.cell(row, 1).value),
            "company": clean_text(sheet.cell(row, 2).value),
            "month": month,
            "start_date": iso_date(sheet.cell(row, 4).value),
            "end_date": iso_date(sheet.cell(row, 5).value),
            "days": int(sheet.cell(row, 6).value or 0),
            "amount": number(sheet.cell(row, 8).value),
            "p1": number(sheet.cell(row, 9).value) or 0,
            "p2": number(sheet.cell(row, 12).value) or 0,
            "p3": number(sheet.cell(row, 15).value) or 0,
            "consumption": number(sheet.cell(row, 18).value) or 0,
            "daily_consumption": number(sheet.cell(row, 19).value) or 0,
            "daily_amount": number(sheet.cell(row, 7).value) or 0,
            "cost_per_kwh": number(sheet.cell(row, 20).value) or 0,
            "p1_share": number(sheet.cell(row, 11).value) or 0,
            "p2_share": number(sheet.cell(row, 14).value) or 0,
            "p3_share": number(sheet.cell(row, 17).value) or 0,
        }
    )

floor = []
sheet = book["Consumo Suelo"]
for row in range(2, sheet.max_row + 1):
    month = iso_date(sheet.cell(row, 3).value)
    if not month:
        continue
    floor.append(
        {
            "property": clean_text(sheet.cell(row, 1).value),
            "company": clean_text(sheet.cell(row, 2).value),
            "month": month,
            "start_date": iso_date(sheet.cell(row, 4).value),
            "end_date": iso_date(sheet.cell(row, 5).value),
            "days": int(sheet.cell(row, 6).value or 0),
            "amount": number(sheet.cell(row, 27).value),
            "cold_kwh": number(sheet.cell(row, 9).value) or 0,
            "heat_kwh": number(sheet.cell(row, 14).value) or 0,
            "water_m3": number(sheet.cell(row, 19).value) or 0,
            "fixed": number(sheet.cell(row, 24).value) or 0,
            "cold_price": number(sheet.cell(row, 10).value) or 0,
            "cold_total": number(sheet.cell(row, 11).value) or 0,
            "heat_price": number(sheet.cell(row, 15).value) or 0,
            "heat_total": number(sheet.cell(row, 16).value) or 0,
            "water_price": number(sheet.cell(row, 20).value) or 0,
            "water_total": number(sheet.cell(row, 21).value) or 0,
            "daily_amount": number(sheet.cell(row, 28).value) or 0,
            "cold_share": number(sheet.cell(row, 13).value) or 0,
            "heat_share": number(sheet.cell(row, 18).value) or 0,
            "water_share": number(sheet.cell(row, 23).value) or 0,
            "fixed_share": number(sheet.cell(row, 26).value) or 0,
            "vat_rate": 21,
        }
    )

vehicle = []
sheet = book["Gastos Coche"]
for row in range(2, sheet.max_row + 1):
    date = iso_date(sheet.cell(row, 1).value)
    price_or_amount = number(sheet.cell(row, 4).value)
    extended_amount = number(sheet.cell(row, 5).value)
    amount = extended_amount if extended_amount is not None else price_or_amount
    if date and amount is not None:
        description = clean_text(sheet.cell(row, 2).value)
        is_fuel_table = extended_amount is not None
        vehicle.append(
            {
                "date": date,
                "description": description,
                "category": "Gasolina",
                "vehicle": clean_text(sheet.cell(row, 3).value),
                "amount": amount,
                "unit_price": price_or_amount if is_fuel_table else None,
                "quantity": number(sheet.cell(row, 6).value) if is_fuel_table else None,
            }
        )
    service_date = iso_date(sheet.cell(row, 14).value)
    service_amount = number(sheet.cell(row, 21).value)
    if service_date and service_amount is not None:
        vehicle.append(
            {
                "date": service_date,
                "description": clean_text(sheet.cell(row, 16).value),
                "category": clean_text(sheet.cell(row, 20).value) or "Otros",
                "vehicle": None,
                "amount": service_amount,
            }
        )

payload = {
    "meta": {
        "source_updated": SOURCE.stat().st_mtime,
        "generated": dt.datetime.now(dt.timezone.utc).isoformat(),
        "excluded_sheets": ["Previsión Luz", "X Gasolina Moto", "Comparación"],
    },
    "summary": summary,
    "monthly": monthly,
    "electricity": electricity,
    "floor": floor,
    "vehicle": sorted(vehicle, key=lambda item: item["date"]),
}

DATA_PATH.parent.mkdir(parents=True, exist_ok=True)
DATA_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
PUBLIC_DATA_PATH.parent.mkdir(parents=True, exist_ok=True)
PUBLIC_DATA_PATH.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")


def sql_value(value):
    if value is None:
        return "NULL"
    if isinstance(value, (int, float)):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


lines = [
    "CREATE TABLE IF NOT EXISTS facturas_summary (id INTEGER PRIMARY KEY, property TEXT NOT NULL, category TEXT NOT NULL, start_date TEXT, end_date TEXT, days INTEGER, daily_average REAL, total REAL);",
    "CREATE TABLE IF NOT EXISTS facturas_monthly (id INTEGER PRIMARY KEY, property TEXT NOT NULL, month TEXT NOT NULL, days INTEGER, daily_average REAL, total REAL, alquiler REAL, luz REAL, calefaccion REAL, agua REAL, internet REAL, limpieza REAL);",
    "CREATE TABLE IF NOT EXISTS facturas_electricity (id INTEGER PRIMARY KEY, property TEXT, company TEXT, month TEXT, start_date TEXT, end_date TEXT, days INTEGER, amount REAL, p1 REAL, p2 REAL, p3 REAL, consumption REAL, daily_consumption REAL);",
    "CREATE TABLE IF NOT EXISTS facturas_floor (id INTEGER PRIMARY KEY, property TEXT, company TEXT, month TEXT, start_date TEXT, end_date TEXT, days INTEGER, amount REAL, cold_kwh REAL, heat_kwh REAL, water_m3 REAL, fixed REAL);",
    "CREATE TABLE IF NOT EXISTS facturas_vehicle (id INTEGER PRIMARY KEY, date TEXT, description TEXT, category TEXT, vehicle TEXT, amount REAL);",
    "CREATE INDEX IF NOT EXISTS idx_facturas_monthly_month ON facturas_monthly(month);",
    "CREATE INDEX IF NOT EXISTS idx_facturas_electricity_month ON facturas_electricity(month);",
    "CREATE INDEX IF NOT EXISTS idx_facturas_floor_month ON facturas_floor(month);",
    "CREATE INDEX IF NOT EXISTS idx_facturas_vehicle_date ON facturas_vehicle(date);",
    "DELETE FROM facturas_summary;",
    "DELETE FROM facturas_monthly;",
    "DELETE FROM facturas_electricity;",
    "DELETE FROM facturas_floor;",
    "DELETE FROM facturas_vehicle;",
]

for index, item in enumerate(summary, 1):
    values = [index, item["property"], item["category"], item["start_date"], item["end_date"], item["days"], item["daily_average"], item["total"]]
    lines.append("INSERT INTO facturas_summary VALUES (" + ",".join(sql_value(value) for value in values) + ");")

for index, item in enumerate(monthly, 1):
    categories = item["categories"]
    values = [index, item["property"], item["month"], item["days"], item["daily_average"], item["total"], categories["Alquiler"], categories["Luz"], categories["Calefacción"], categories["Agua"], categories["Internet"], categories["Limpieza"]]
    lines.append("INSERT INTO facturas_monthly VALUES (" + ",".join(sql_value(value) for value in values) + ");")

for table, items, fields in [
    ("facturas_electricity", electricity, ["property", "company", "month", "start_date", "end_date", "days", "amount", "p1", "p2", "p3", "consumption", "daily_consumption"]),
    ("facturas_floor", floor, ["property", "company", "month", "start_date", "end_date", "days", "amount", "cold_kwh", "heat_kwh", "water_m3", "fixed"]),
    ("facturas_vehicle", vehicle, ["date", "description", "category", "vehicle", "amount"]),
]:
    for index, item in enumerate(items, 1):
        values = [index] + [item[field] for field in fields]
        lines.append(f"INSERT INTO {table} VALUES (" + ",".join(sql_value(value) for value in values) + ");")

MIGRATION_PATH.parent.mkdir(parents=True, exist_ok=True)
MIGRATION_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")

print(
    json.dumps(
        {key: len(value) for key, value in payload.items() if isinstance(value, list)},
        ensure_ascii=False,
    )
)
