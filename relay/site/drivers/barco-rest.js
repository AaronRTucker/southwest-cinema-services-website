"use strict";

// Barco Series 4 REST API driver (SP4K-25B, DP4K-32B, SP4K-15C, etc.)
// Auth: GET /rest with Basic Auth → JWT Bearer token.
// Most endpoints are flat single-value GETs returning { result: <value> }.

// ── Authentication ────────────────────────────────────────────────────────────

const tokenCache = new Map(); // ip → { token, expiresAt }

async function getToken(ip, user, password) {
  const cached = tokenCache.get(ip);
  if (cached && cached.expiresAt > Date.now()) return cached.token;

  const res = await fetch(`http://${ip}/rest`, {
    headers: { Authorization: "Basic " + Buffer.from(`${user}:${password}`).toString("base64") },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Auth failed: HTTP ${res.status}`);
  const data = await res.json();
  const token = data.access_token;
  if (!token) throw new Error("No access_token in auth response");
  tokenCache.set(ip, { token, expiresAt: Date.now() + 55 * 60 * 1000 });
  return token;
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────

async function get(ip, path, token) {
  const res = await fetch(`http://${ip}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function post(ip, path, token, body = {}) {
  const res = await fetch(`http://${ip}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function tryGet(ip, path, token, fallback = null) {
  try { return await get(ip, path, token); } catch { return fallback; }
}

async function tryPost(ip, path, token, body = {}, fallback = null) {
  try { return await post(ip, path, token, body); } catch { return fallback; }
}

// Try a list of GET paths; return first that succeeds
async function tryPaths(ip, paths, token, fallback = null) {
  for (const path of paths) {
    const r = await tryGet(ip, path, token);
    if (r !== null) return r;
  }
  return fallback;
}

// Extract value from { result: x } or { value: x }
function val(obj, ...keys) {
  if (!obj) return undefined;
  // Check result/value first, then named keys
  for (const k of ["result", "value", ...keys]) {
    if (obj[k] !== undefined && obj[k] !== null) return obj[k];
  }
  return undefined;
}

// ── Normalizers ───────────────────────────────────────────────────────────────

function normalizeTemperatures(data) {
  const arr = Array.isArray(data) ? data : (data?.result ?? []);
  return arr.map((t) => {
    const value    = parseFloat(val(t) ?? 0);
    const warning  = parseFloat(t.warningLevel ?? t.warning ?? 255);
    const critical = parseFloat(t.criticalLevel ?? t.critical ?? 255);
    return {
      name: t.name ?? t.Name ?? "Unknown",
      value, warning, critical, unit: "°C",
      status: value >= critical ? "critical" : value >= warning ? "warning" : "ok",
    };
  });
}

function normalizeFans(data) {
  const arr = Array.isArray(data) ? data : (data?.result ?? []);
  return arr.map((f) => {
    const value   = Math.round(parseFloat(val(f) ?? 0));
    const warning = parseFloat(f.warningLevel ?? f.warning ?? 0);
    return {
      name: f.name ?? f.Name ?? "Unknown",
      value, warning, unit: "RPM",
      status: warning > 0 && value < warning ? "warning" : "ok",
    };
  });
}

function normalizeVoltages(data) {
  const arr = Array.isArray(data) ? data : (data?.result ?? []);
  return arr.map((v) => {
    const value     = parseFloat(val(v) ?? 0);
    const nominal   = parseFloat(v.nominalValue ?? v.nominal ?? value);
    const tolerance = parseFloat(v.tolerance ?? nominal * 0.05);
    return {
      name: v.name ?? v.Name ?? "Unknown",
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
    const type = item.type ?? item.severity ?? "W";
    const alert = {
      type: type === "E" || type === "error" ? "E" : "W",
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

  let token;
  try {
    token = await getToken(ip, user, password);
  } catch (err) {
    throw new Error(`Auth: ${err.message}`);
  }

  const [
    state, serial, laserPower,
    model, firmware, lampHours,
    temps, fans, voltages, alerts, dowser,
  ] = await Promise.all([
    tryGet(ip, "/rest/system/state",                           token),
    tryGet(ip, "/rest/system/serialnumber",                    token),
    tryGet(ip, "/rest/illumination/sources/laser/actualpower", token),
    // Model — try flat GET paths, then POST variants
    tryPaths(ip, [
      "/rest/system/productname", "/rest/system/model",
      "/rest/system/producttype", "/rest/system/type",
    ], token).then((r) => r ?? tryPost(ip, "/rest/system/type", token)),
    // Firmware
    tryPaths(ip, [
      "/rest/system/softwareversion", "/rest/system/firmware",
      "/rest/system/firmwareversion", "/rest/system/version",
    ], token),
    // Lamp/laser hours
    tryPaths(ip, [
      "/rest/illumination/sources/laser/operatinghours",
      "/rest/illumination/sources/laser/runtime",
      "/rest/illumination/sources/laser/runtimeminutes",
      "/rest/illumination/sources/laser/hourmeter",
      "/rest/system/runtime",
    ], token),
    // Health sensors — try POST since GET returns 400
    tryPost(ip, "/rest/diagnostics/temperatures", token).then((r) => r ?? tryPost(ip, "/rest/environment/temperatures", token)),
    tryPost(ip, "/rest/diagnostics/fans",         token).then((r) => r ?? tryPost(ip, "/rest/environment/fans", token)),
    tryPost(ip, "/rest/diagnostics/voltages",     token).then((r) => r ?? tryPost(ip, "/rest/environment/voltages", token)),
    tryPost(ip, "/rest/system/health",            token).then((r) => r ?? tryPost(ip, "/rest/diagnostics/alerts", token)),
    tryPaths(ip, [
      "/rest/illumination/sources/laser/dowser",
      "/rest/illumination/dowser",
    ], token),
  ]);

  const stateVal   = val(state)   ?? "unknown";
  const isOn       = stateVal === "on";
  const serialVal  = val(serial)  ?? "";
  const modelVal   = val(model)   ?? "Barco";
  const fwVal      = val(firmware) ?? "";
  const lampVal    = val(lampHours) ?? 0;
  // If runtime in minutes convert to hours, otherwise assume hours
  const lampHoursNum = lampVal > 50000 ? Math.round(lampVal / 60) : Math.round(lampVal);

  const dowserVal  = val(dowser);
  const health = {
    temperatures: normalizeTemperatures(temps),
    voltages:     normalizeVoltages(voltages),
    fans:         normalizeFans(fans),
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
    model: modelVal, serial: serialVal, firmware: fwVal,
    state: stateVal,
    laserPower: isOn ? parseFloat(val(laserPower) ?? 0) : 0,
    lampHours: lampHoursNum, lampHoursWarning: 10000, lampHoursEol: 15000,
    dowserOpen: dowserVal === "open" || dowserVal === true || dowserVal === 1,
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
