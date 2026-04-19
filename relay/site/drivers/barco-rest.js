"use strict";

// Barco Series 4 REST API driver (SP4K-25B, DP4K-32B, SP4K-15C, etc.)
// Uses built-in fetch (Node 18+).

function authHeader(user, password) {
  return "Basic " + Buffer.from(`${user}:${password}`).toString("base64");
}

async function get(ip, path, user, password) {
  const res = await fetch(`http://${ip}${path}`, {
    headers: { Authorization: authHeader(user, password) },
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function tryGet(ip, path, user, password, fallback = null) {
  try { return await get(ip, path, user, password); } catch { return fallback; }
}

// Try multiple candidate paths, return first that succeeds (not null)
async function tryPaths(ip, paths, user, password) {
  for (const path of paths) {
    const result = await tryGet(ip, path, user, password);
    if (result !== null) {
      console.log(`[${ip}] resolved ${path}:`, JSON.stringify(result).slice(0, 200));
      return result;
    }
  }
  console.log(`[${ip}] all paths failed:`, paths.join(", "));
  return null;
}

// Barco returns { result: <value> } — handle both result and value
function r(obj, ...keys) {
  if (!obj) return undefined;
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null) return obj[k];
  }
  return undefined;
}

// ── Normalizers ───────────────────────────────────────────────────────────────

function normalizeTemperatures(data) {
  if (!Array.isArray(data)) return [];
  return data.map((t) => {
    const value    = parseFloat(r(t, "result", "value", "Value") ?? 0);
    const warning  = parseFloat(r(t, "warningLevel", "warning", "Warning") ?? 255);
    const critical = parseFloat(r(t, "criticalLevel", "critical", "Critical") ?? 255);
    return {
      name: r(t, "name", "Name") ?? "Unknown",
      value, warning, critical, unit: "°C",
      status: value >= critical ? "critical" : value >= warning ? "warning" : "ok",
    };
  });
}

function normalizeFans(data) {
  if (!Array.isArray(data)) return [];
  return data.map((f) => {
    const value   = Math.round(parseFloat(r(f, "result", "value", "Value") ?? 0));
    const warning = parseFloat(r(f, "warningLevel", "warning", "Warning") ?? 0);
    return {
      name: r(f, "name", "Name") ?? "Unknown",
      value, warning, unit: "RPM",
      status: warning > 0 && value < warning ? "warning" : "ok",
    };
  });
}

function normalizeVoltages(data) {
  if (!Array.isArray(data)) return [];
  return data.map((v) => {
    const value     = parseFloat(r(v, "result", "value", "Value") ?? 0);
    const nominal   = parseFloat(r(v, "nominalValue", "nominal", "Nominal") ?? value);
    const tolerance = parseFloat(r(v, "tolerance", "Tolerance") ?? nominal * 0.05);
    return {
      name: r(v, "name", "Name") ?? "Unknown",
      value, nominal, tolerance, unit: "V",
      status: Math.abs(value - nominal) > tolerance ? "warning" : "ok",
    };
  });
}

function normalizeAlerts(data) {
  const errors = [], warnings = [];
  if (!data) return { errors, warnings };
  const items = Array.isArray(data) ? data : (data.alerts ?? data.items ?? data.result ?? []);
  if (!Array.isArray(items)) return { errors, warnings };
  for (const item of items) {
    const severity = item.type ?? item.severity ?? "W";
    const alert = {
      type: severity === "E" || severity === "error" ? "E" : "W",
      uid: item.uid ?? item.id ?? item.code ?? "",
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
    tryGet(ip, "/rest/system/state", user, password),
    tryPaths(ip, [
      "/rest/system/productioninfo",
      "/rest/system/deviceinfo",
      "/rest/system/information",
      "/rest/system/getidentifications",
      "/rest/system/overview",
    ], user, password),
    tryGet(ip, "/rest/illumination/sources/laser/actualpower", user, password),
    tryPaths(ip, [
      "/rest/illumination/sources/laser/runtime",
      "/rest/illumination/sources/laser/runtimeminutes",
      "/rest/illumination/sources/laser/hourmeter",
      "/rest/system/runtime",
    ], user, password),
    tryPaths(ip, [
      "/rest/diagnostics/temperatures",
      "/rest/environment/temperatures",
      "/rest/system/temperatures",
    ], user, password, []),
    tryPaths(ip, [
      "/rest/diagnostics/fans",
      "/rest/environment/fans",
      "/rest/system/fans",
    ], user, password, []),
    tryPaths(ip, [
      "/rest/diagnostics/voltages",
      "/rest/environment/voltages",
      "/rest/system/voltages",
    ], user, password, []),
    tryPaths(ip, [
      "/rest/system/health",
      "/rest/diagnostics/alerts",
      "/rest/system/alerts",
      "/rest/diagnostics/health",
    ], user, password),
    tryPaths(ip, [
      "/rest/illumination/sources/laser/dowser",
      "/rest/illumination/dowser",
      "/rest/system/dowser",
    ], user, password),
  ]);

  const stateVal  = r(state, "result", "value") ?? "unknown";
  const isOn      = stateVal === "on";
  const lampMins  = r(laserRuntime, "result", "value") ?? 0;
  const lampHours = Math.round(lampMins / 60);

  // ident may be an object or array — handle both shapes
  const identObj  = Array.isArray(ident) ? ident[0] : ident;
  const model     = r(identObj, "ProductLine", "productLine", "model", "Model", "product") ?? "Barco";
  const serial    = r(identObj, "SerialNumber", "serialNumber", "serial", "Serial") ?? "";
  const firmware  = r(identObj, "version", "Version", "firmware", "FirmwareVersion") ?? "";

  const dowserVal = r(dowser, "result", "value");
  const dowserOpen = dowserVal === "open" || dowserVal === true || dowserVal === 1;

  const health = {
    temperatures: normalizeTemperatures(Array.isArray(temps) ? temps : (temps?.result ?? [])),
    voltages:     normalizeVoltages(Array.isArray(voltages) ? voltages : (voltages?.result ?? [])),
    fans:         normalizeFans(Array.isArray(fans) ? fans : (fans?.result ?? [])),
    ...normalizeAlerts(alerts),
  };

  const overallStatus =
    health.errors.length > 0 ? "error"
    : health.warnings.length > 0
      || health.temperatures.some((t) => t.status !== "ok")
      || health.fans.some((f) => f.status !== "ok")
    ? "warning" : "ok";

  return {
    id: proj.id, name: proj.name, ip,
    model, serial, firmware,
    state: stateVal,
    laserPower: isOn ? parseFloat(r(laserPower, "result", "value") ?? 0) : 0,
    lampHours, lampHoursWarning: 10000, lampHoursEol: 15000,
    dowserOpen,
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
        state: "unreachable", laserPower: 0,
        lampHours: 0, lampHoursWarning: 10000, lampHoursEol: 15000,
        dowserOpen: false,
        health: { temperatures: [], voltages: [], fans: [], errors: [], warnings: [] },
        status: "error", error: err.message,
        polledAt: new Date().toISOString(),
      }))
    )
  );
}

module.exports = { poll };
