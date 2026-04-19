"use strict";

// Barco Series 4 REST API driver (SP4K-25B, DP4K-32B, SP4K-15C, etc.)
// Auth: POST /rest with Basic credentials → JWT Bearer token for all requests.

// ── Authentication ────────────────────────────────────────────────────────────

// ip → { token, expiresAt }
const tokenCache = new Map();

async function getToken(ip, user, password) {
  const cached = tokenCache.get(ip);
  if (cached && cached.expiresAt > Date.now()) return cached.token;

  const res = await fetch(`http://${ip}/rest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Basic " + Buffer.from(`${user}:${password}`).toString("base64"),
    },
    body: JSON.stringify({ username: user, password }),
    signal: AbortSignal.timeout(8000),
  });

  // Some firmware issues token on GET /rest with Basic — fall back if POST fails
  if (!res.ok) {
    const res2 = await fetch(`http://${ip}/rest`, {
      headers: { Authorization: "Basic " + Buffer.from(`${user}:${password}`).toString("base64") },
      signal: AbortSignal.timeout(8000),
    });
    if (!res2.ok) throw new Error(`Auth failed: HTTP ${res2.status}`);
    const data2 = await res2.json();
    const token2 = data2.access_token;
    if (!token2) throw new Error("No access_token returned");
    tokenCache.set(ip, { token: token2, expiresAt: Date.now() + 55 * 60 * 1000 });
    return token2;
  }

  const data = await res.json();
  const token = data.access_token;
  if (!token) throw new Error("No access_token returned");
  tokenCache.set(ip, { token, expiresAt: Date.now() + 55 * 60 * 1000 });
  return token;
}

async function get(ip, path, token) {
  const res = await fetch(`http://${ip}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function tryGet(ip, path, token, fallback = null) {
  try { return await get(ip, path, token); } catch { return fallback; }
}

async function tryPaths(ip, paths, token, fallback = null) {
  for (const path of paths) {
    const result = await tryGet(ip, path, token);
    if (result !== null) {
      console.log(`[${ip}] resolved ${path}:`, JSON.stringify(result).slice(0, 300));
      return result;
    }
  }
  console.log(`[${ip}] all failed:`, paths.join(", "));
  return fallback;
}

// ── API discovery (runs once per projector) ───────────────────────────────────

const discovered = new Set();

async function discoverApi(ip, token) {
  if (discovered.has(ip)) return;
  discovered.add(ip);
  const probes = [
    "/rest/system",
    "/rest/system/status",
    "/rest/system/state",
    "/rest/system/information",
    "/rest/system/productioninfo",
    "/rest/system/deviceinfo",
    "/rest/system/getidentifications",
    "/rest/system/health",
    "/rest/illumination",
    "/rest/illumination/sources",
    "/rest/illumination/sources/laser",
    "/rest/illumination/sources/laser/runtime",
    "/rest/illumination/sources/laser/runtimeminutes",
    "/rest/illumination/sources/laser/hourmeter",
    "/rest/illumination/sources/laser/dowser",
    "/rest/illumination/dowser",
    "/rest/diagnostics",
    "/rest/diagnostics/temperatures",
    "/rest/diagnostics/fans",
    "/rest/diagnostics/voltages",
    "/rest/environment/temperatures",
    "/rest/environment/fans",
    "/rest/environment/voltages",
  ];
  console.log(`\n[${ip}] === API DISCOVERY (Bearer) ===`);
  for (const path of probes) {
    const result = await tryGet(ip, path, token);
    if (result !== null) {
      console.log(`[${ip}] OK ${path}:`, JSON.stringify(result).slice(0, 400));
    }
  }
  console.log(`[${ip}] === END DISCOVERY ===\n`);
}

// ── Normalizers ───────────────────────────────────────────────────────────────

function r(obj, ...keys) {
  if (!obj) return undefined;
  for (const k of keys) if (obj[k] !== undefined && obj[k] !== null) return obj[k];
  return undefined;
}

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

  // Invalidate cached token on auth error
  let token;
  try {
    token = await getToken(ip, user, password);
  } catch (err) {
    throw new Error(`Auth: ${err.message}`);
  }

  await discoverApi(ip, token);

  const [
    state, ident, laserPower, laserRuntime,
    temps, fans, voltages, alerts, dowser,
  ] = await Promise.all([
    tryGet(ip, "/rest/system/state", token),
    tryPaths(ip, [
      "/rest/system/productioninfo",
      "/rest/system/deviceinfo",
      "/rest/system/information",
      "/rest/system/getidentifications",
      "/rest/system/overview",
      "/rest/system/status",
    ], token),
    tryGet(ip, "/rest/illumination/sources/laser/actualpower", token),
    tryPaths(ip, [
      "/rest/illumination/sources/laser/runtime",
      "/rest/illumination/sources/laser/runtimeminutes",
      "/rest/illumination/sources/laser/hourmeter",
      "/rest/system/runtime",
    ], token),
    tryPaths(ip, [
      "/rest/diagnostics/temperatures",
      "/rest/environment/temperatures",
      "/rest/system/temperatures",
    ], token, []),
    tryPaths(ip, [
      "/rest/diagnostics/fans",
      "/rest/environment/fans",
      "/rest/system/fans",
    ], token, []),
    tryPaths(ip, [
      "/rest/diagnostics/voltages",
      "/rest/environment/voltages",
      "/rest/system/voltages",
    ], token, []),
    tryPaths(ip, [
      "/rest/system/health",
      "/rest/diagnostics/alerts",
      "/rest/system/alerts",
      "/rest/diagnostics/health",
    ], token),
    tryPaths(ip, [
      "/rest/illumination/sources/laser/dowser",
      "/rest/illumination/dowser",
      "/rest/system/dowser",
    ], token),
  ]);

  const stateVal  = r(state,        "result", "value") ?? "unknown";
  const isOn      = stateVal === "on";
  const lampMins  = r(laserRuntime, "result", "value") ?? 0;
  const lampHours = Math.round(lampMins / 60);

  const identObj  = Array.isArray(ident) ? ident[0] : ident;
  const model     = r(identObj, "ProductLine", "productLine", "model", "Model", "product", "type") ?? "Barco";
  const serial    = r(identObj, "SerialNumber", "serialNumber", "serial", "Serial") ?? "";
  const firmware  = r(identObj, "version", "Version", "firmware", "FirmwareVersion") ?? "";

  const dowserVal  = r(dowser, "result", "value");
  const dowserOpen = dowserVal === "open" || dowserVal === true || dowserVal === 1;

  const health = {
    temperatures: normalizeTemperatures(Array.isArray(temps)    ? temps    : (temps?.result    ?? [])),
    voltages:     normalizeVoltages(Array.isArray(voltages) ? voltages : (voltages?.result ?? [])),
    fans:         normalizeFans(Array.isArray(fans)      ? fans      : (fans?.result      ?? [])),
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
