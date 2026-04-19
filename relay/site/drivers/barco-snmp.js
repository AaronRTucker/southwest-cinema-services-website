"use strict";

const snmp = require("net-snmp");

// Barco Series 4 SNMP driver
// Enterprise base: 1.3.6.1.4.1.12612.220.11
const B = "1.3.6.1.4.1.12612.220.11";

const OIDS = {
  sysName:    "1.3.6.1.2.1.1.5.0",          // "SP4K-12C-2590413587"
  serial:     `${B}.2.2.1.0`,
  firmware:   `${B}.2.2.8.0`,
  model:      `${B}.2.2.12.1.0`,             // "SP4K-12C"
  powerState: `${B}.2.2.5.0`,               // 1=on, 0=off/standby
  laserPower: `${B}.2.2.4.6.0`,             // %
  runtime:    `${B}.2.2.4.8.1.2.1`,         // minutes
};

const TEMP_BASE    = `${B}.4.2.1.1.1`;
const VOLTAGE_BASE = `${B}.4.2.1.2.1`;
const FAN_BASE     = `${B}.4.2.1.3.1`;

// ── SNMP helpers ──────────────────────────────────────────────────────────────

function readValue(vb) {
  if (Buffer.isBuffer(vb.value)) return vb.value.toString("ascii").replace(/\0/g, "").trim();
  return vb.value;
}

function snmpGet(session, oids) {
  return new Promise((resolve, reject) => {
    session.get(oids, (err, varbinds) => {
      if (err) return reject(err);
      const out = {};
      for (const vb of varbinds) {
        if (!snmp.isVarbindError(vb)) out[vb.oid] = readValue(vb);
      }
      resolve(out);
    });
  });
}

// Walk a sensor table; OID structure: BASE.column.index
// Returns { index -> { column -> value } }
function walkTable(session, base) {
  return new Promise((resolve) => {
    const rows = {};
    session.walk(base, 20, (varbinds) => {
      for (const vb of varbinds) {
        if (snmp.isVarbindError(vb)) continue;
        const suffix = vb.oid.slice(base.length + 1);
        const dot = suffix.indexOf(".");
        if (dot === -1) continue;
        const col = suffix.slice(0, dot);
        const idx = suffix.slice(dot + 1);
        if (!rows[idx]) rows[idx] = {};
        rows[idx][col] = readValue(vb);
      }
    }, (err) => {
      if (err) console.error(`SNMP walk error on ${base}:`, err.message);
      resolve(rows);
    });
  });
}

// ── Sensor normalizers ────────────────────────────────────────────────────────

function buildTemperatures(rows) {
  return Object.entries(rows)
    .filter(([, cols]) => cols["8"])
    .map(([, cols]) => {
      const value    = parseFloat(cols["2"] ?? 0);
      const warnHigh = parseFloat(cols["6"] ?? 255);
      const critHigh = parseFloat(cols["4"] ?? 255);
      const alarm    = parseInt(cols["7"] ?? 0);
      return {
        name: cols["8"],
        value, warning: warnHigh, critical: critHigh, unit: "°C",
        status: alarm !== 0 ? (value >= critHigh ? "critical" : "warning") : "ok",
      };
    });
}

function buildVoltages(rows) {
  return Object.entries(rows)
    .filter(([, cols]) => cols["8"])
    .map(([, cols]) => {
      const value    = parseFloat(cols["2"] ?? 0) / 1000;   // mV → V
      const nomLow   = parseFloat(cols["5"] ?? cols["2"] ?? 0) / 1000;
      const nomHigh  = parseFloat(cols["6"] ?? cols["2"] ?? 0) / 1000;
      const nominal  = (nomLow + nomHigh) / 2 || value;
      const warnLow  = parseFloat(cols["3"] ?? 0) / 1000;
      const warnHigh = parseFloat(cols["4"] ?? 9999) / 1000;
      const alarm    = parseInt(cols["7"] ?? 0);
      return {
        name: cols["8"],
        value, nominal,
        tolerance: Math.max(nominal - warnLow, warnHigh - nominal, 0),
        unit: "V",
        status: alarm !== 0 ? "warning" : "ok",
      };
    });
}

function buildFans(rows) {
  return Object.entries(rows)
    .filter(([, cols]) => cols["8"])
    .map(([, cols]) => {
      const value   = parseFloat(cols["2"] ?? 0);
      const warnLow = parseFloat(cols["3"] ?? 0);
      const alarm   = parseInt(cols["7"] ?? 0);
      return {
        name: cols["8"],
        value, warning: warnLow, unit: "RPM",
        status: alarm !== 0 ? "warning" : "ok",
      };
    });
}

function buildAlerts(temps, voltages, fans) {
  const warnings = [];
  for (const t of temps) {
    if (t.status === "critical") warnings.push({ type: "E", uid: "", description: `${t.name}: ${t.value}°C (critical)` });
    else if (t.status === "warning") warnings.push({ type: "W", uid: "", description: `${t.name}: ${t.value}°C (high temp)` });
  }
  for (const v of voltages) {
    if (v.status !== "ok") warnings.push({ type: "W", uid: "", description: `${v.name}: ${v.value.toFixed(2)}V` });
  }
  for (const f of fans) {
    if (f.status !== "ok") warnings.push({ type: "W", uid: "", description: `${f.name}: ${f.value} RPM (low)` });
  }
  return {
    errors:   warnings.filter((a) => a.type === "E"),
    warnings: warnings.filter((a) => a.type === "W"),
  };
}

// ── Per-projector poll ────────────────────────────────────────────────────────

async function pollOne(proj) {
  const { ip, snmpCommunity: community = "public" } = proj;

  const session = snmp.createSession(ip, community, {
    version: snmp.Version2c,
    timeout: 8000,
    retries: 1,
  });

  try {
    // Run sequentially — concurrent walks on one session cross-contaminate responses
    const identity = await snmpGet(session, Object.values(OIDS));
    const tempRows = await walkTable(session, TEMP_BASE);
    const voltRows = await walkTable(session, VOLTAGE_BASE);
    const fanRows  = await walkTable(session, FAN_BASE);

    const powerState = parseInt(identity[OIDS.powerState] ?? 0);
    const isOn = powerState === 1;

    // Model: try dedicated OID first, fall back to parsing sysName
    let modelVal = String(identity[OIDS.model] ?? "").trim();
    if (!modelVal) {
      const sysName = String(identity[OIDS.sysName] ?? "");
      modelVal = sysName.split("-").slice(0, 2).join("-") || "Barco";
    }

    const runtimeMin = parseFloat(identity[OIDS.runtime] ?? 0);
    const lampHoursNum = runtimeMin > 1000 ? Math.round(runtimeMin / 60) : Math.round(runtimeMin);

    const temperatures = buildTemperatures(tempRows);
    const voltages     = buildVoltages(voltRows);
    const fans         = buildFans(fanRows);
    const { errors, warnings } = buildAlerts(temperatures, voltages, fans);

    const overallStatus =
      errors.length > 0 ? "error"
      : warnings.length > 0
        || temperatures.some((t) => t.status !== "ok")
        || fans.some((f) => f.status !== "ok")
      ? "warning" : "ok";

    return {
      id: proj.id, name: proj.name, ip,
      model: modelVal,
      serial: String(identity[OIDS.serial] ?? "").trim(),
      firmware: String(identity[OIDS.firmware] ?? "").trim(),
      state: isOn ? "on" : "standby",
      laserPower: isOn ? parseFloat(identity[OIDS.laserPower] ?? 0) : 0,
      lampHours: lampHoursNum, lampHoursWarning: 10000, lampHoursEol: 15000,
      dowserOpen: false,
      health: { temperatures, voltages, fans, errors, warnings },
      status: overallStatus,
      polledAt: new Date().toISOString(),
    };
  } finally {
    session.close();
  }
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
