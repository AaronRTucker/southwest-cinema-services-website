"use strict";

// Barco Series 4 REST API driver (SP4K-25B, DP4K-32B, SP4K-15C, etc.)
// Uses built-in fetch (Node 18+) — no node-fetch needed.

function authHeader(user, password) {
  return "Basic " + Buffer.from(`${user}:${password}`).toString("base64");
}

async function get(ip, path, user, password) {
  const res = await fetch(`http://${ip}${path}`, {
    headers: { Authorization: authHeader(user, password) },
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`);
  return res.json();
}

// Non-fatal fetch — returns fallback on any error
async function tryGet(ip, path, user, password, fallback = null) {
  try { return await get(ip, path, user, password); } catch { return fallback; }
}

// ── Normalizers ───────────────────────────────────────────────────────────────
// Barco's API field names vary slightly across firmware versions; we handle both.

function normalizeTemperatures(data) {
  if (!Array.isArray(data)) return [];
  return data.map((t) => {
    const value   = parseFloat(t.value   ?? t.Value   ?? 0);
    const warning = parseFloat(t.warningLevel  ?? t.warning  ?? t.Warning  ?? 255);
    const critical= parseFloat(t.criticalLevel ?? t.critical ?? t.Critical ?? 255);
    return {
      name:     t.name ?? t.Name ?? "Unknown",
      value,
      warning,
      critical,
      unit: "°C",
      status: value >= critical ? "critical" : value >= warning ? "warning" : "ok",
    };
  });
}

function normalizeFans(data) {
  if (!Array.isArray(data)) return [];
  return data.map((f) => {
    const value   = Math.round(parseFloat(f.value ?? f.Value ?? 0));
    const warning = parseFloat(f.warningLevel ?? f.warning ?? f.Warning ?? 0);
    return {
      name: f.name ?? f.Name ?? "Unknown",
      value,
      warning,
      unit: "RPM",
      status: warning > 0 && value < warning ? "warning" : "ok",
    };
  });
}

function normalizeVoltages(data) {
  if (!Array.isArray(data)) return [];
  return data.map((v) => {
    const value     = parseFloat(v.value     ?? v.Value     ?? 0);
    const nominal   = parseFloat(v.nominalValue ?? v.nominal ?? v.Nominal ?? value);
    const tolerance = parseFloat(v.tolerance ?? v.Tolerance ?? nominal * 0.05);
    return {
      name: v.name ?? v.Name ?? "Unknown",
      value,
      nominal,
      tolerance,
      unit: "V",
      status: Math.abs(value - nominal) > tolerance ? "warning" : "ok",
    };
  });
}

function normalizeAlerts(data) {
  const errors = [], warnings = [];
  if (!data) return { errors, warnings };
  const items = Array.isArray(data) ? data : (data.alerts ?? data.items ?? []);
  for (const item of items) {
    const severity = item.type ?? item.severity ?? "W";
    const alert = {
      type: severity === "E" || severity === "error" ? "E" : "W",
      uid:  item.uid ?? item.id ?? item.code ?? "",
      description: item.description ?? item.message ?? item.text ?? "",
    };
    if (alert.type === "E") errors.push(alert); else warnings.push(alert);
  }
  return { errors, warnings };
}

// ── Per-projector poll ────────────────────────────────────────────────────────

async function pollOne(proj) {
  const { ip, restUser: user = "admin", restPassword: password = "Admin1234" } = proj;

  const [
    state, ident, laserPower, laserRuntime,
    temps, fans, voltages, alerts, dowser,
  ] = await Promise.all([
    tryGet(ip, "/rest/system/state",                               user, password),
    tryGet(ip, "/rest/system/getidentifications",                  user, password),
    tryGet(ip, "/rest/illumination/sources/laser/actualpower",     user, password),
    tryGet(ip, "/rest/illumination/sources/laser/runtimeminutes",  user, password),
    tryGet(ip, "/rest/environment/temperatures",                   user, password, []),
    tryGet(ip, "/rest/environment/fans",                           user, password, []),
    tryGet(ip, "/rest/environment/voltages",                       user, password, []),
    tryGet(ip, "/rest/system/health",                              user, password),
    tryGet(ip, "/rest/illumination/dowser",                        user, password),
  ]);

  // Log raw responses so field names can be verified against the actual firmware
  console.log(`[${ip}] state:`, JSON.stringify(state));
  console.log(`[${ip}] ident:`, JSON.stringify(ident));
  console.log(`[${ip}] laserPower:`, JSON.stringify(laserPower));
  console.log(`[${ip}] laserRuntime:`, JSON.stringify(laserRuntime));
  console.log(`[${ip}] dowser:`, JSON.stringify(dowser));
  if (temps?.length)    console.log(`[${ip}] temps[0]:`, JSON.stringify(temps[0]));
  if (fans?.length)     console.log(`[${ip}] fans[0]:`, JSON.stringify(fans[0]));
  if (voltages?.length) console.log(`[${ip}] voltages[0]:`, JSON.stringify(voltages[0]));
  if (alerts)           console.log(`[${ip}] alerts:`, JSON.stringify(alerts));

  const stateVal   = state?.value ?? "unknown";
  const isOn       = stateVal === "on";
  const lampHours  = Math.round((laserRuntime?.value ?? 0) / 60); // minutes → hours
  const health     = {
    temperatures: normalizeTemperatures(temps),
    voltages:     normalizeVoltages(voltages),
    fans:         normalizeFans(fans),
    ...normalizeAlerts(alerts),
  };

  const overallStatus =
    health.errors.length > 0   ? "error"
    : health.warnings.length > 0
      || health.temperatures.some((t) => t.status !== "ok")
      || health.fans.some((f) => f.status !== "ok")
    ? "warning" : "ok";

  return {
    id:    proj.id,
    name:  proj.name,
    ip,
    model:    ident?.ProductLine  ?? ident?.productLine  ?? "Barco",
    serial:   ident?.SerialNumber ?? ident?.serialNumber ?? "",
    firmware: ident?.version      ?? ident?.Version      ?? "",
    state:    stateVal,
    laserPower:      isOn ? parseFloat(laserPower?.value ?? 0) : 0,
    lampHours,
    lampHoursWarning: 10000,
    lampHoursEol:     15000,
    dowserOpen: dowser?.value === "open" || dowser?.value === true,
    health,
    status: overallStatus,
    polledAt: new Date().toISOString(),
  };
}

// ── Export ────────────────────────────────────────────────────────────────────

async function poll(projectors) {
  return Promise.all(
    projectors.map((p) =>
      pollOne(p).catch((err) => ({
        id: p.id, name: p.name, ip: p.ip,
        model: "Barco", serial: "", firmware: "",
        state: "unreachable",
        laserPower: 0, lampHours: 0, lampHoursWarning: 10000, lampHoursEol: 15000,
        dowserOpen: false,
        health: { temperatures: [], voltages: [], fans: [], errors: [], warnings: [] },
        status: "error",
        error: err.message,
        polledAt: new Date().toISOString(),
      }))
    )
  );
}

module.exports = { poll };
