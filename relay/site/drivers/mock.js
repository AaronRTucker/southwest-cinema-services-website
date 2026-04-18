"use strict";

// Mock Barco cinema projector data based on real SP4K-25B MIB walk
// Sensor names, thresholds, and value ranges match actual SNMP data

const MODELS = ["Barco SP4K-25B", "Barco DP4K-32B", "Barco SP4K-15C"];
const STATES = ["on", "on", "on", "standby", "off"];

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function jitter(base, range) {
  return parseFloat((base + (Math.random() - 0.5) * range).toFixed(1));
}

function jitterInt(base, range) {
  return Math.round(base + (Math.random() - 0.5) * range);
}

function projectorSeed(id) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return h;
}

function mockProjector(projConfig) {
  const seed = projectorSeed(projConfig.id);
  const modelIndex = seed % MODELS.length;
  const stateIndex = seed % STATES.length;
  const baseLampHours = 800 + (seed % 4000);
  const baseLaserPower = 85 + (seed % 12);

  const state = STATES[stateIndex];
  const isOn = state === "on";

  // Temperature sensors — names and thresholds from real SP4K-25B MIB walk
  // Values in °C; 255 = no limit defined in firmware
  const temperatures = [
    { name: "Front air inlet",                    value: jitter(22, 3),  warning: 45,  critical: 55 },
    { name: "FMCB board",                         value: jitter(28, 4),  warning: 80,  critical: 85 },
    { name: "CCB CPU",                             value: jitter(39, 4),  warning: 90,  critical: 100 },
    { name: "LDM 1 main board",                   value: jitter(28, 3),  warning: 52,  critical: 55 },
    { name: "LDM 1 main board heatsink",           value: jitter(45, 5),  warning: 95,  critical: 100 },
    { name: "LDM 2 main board",                   value: jitter(27, 3),  warning: 52,  critical: 55 },
    { name: "LDM 2 main board heatsink",           value: jitter(40, 5),  warning: 95,  critical: 100 },
    { name: "Light source cooling inlet",          value: jitter(22, 3),  warning: 65,  critical: 75 },
    { name: "Light source cooling outlet",         value: jitter(28, 4),  warning: 65,  critical: 75 },
    { name: "ICMP/ICP-D - Environment",            value: jitter(47, 4),  warning: 255, critical: 255 },
    { name: "ICMP/ICP-D - PowerPC",                value: jitter(62, 5),  warning: 255, critical: 255 },
    { name: "Blue DMD front",                      value: jitter(37, 4),  warning: 60,  critical: 65 },
    { name: "Green DMD front",                     value: jitter(37, 4),  warning: 60,  critical: 65 },
    { name: "Red DMD front",                       value: jitter(35, 4),  warning: 60,  critical: 65 },
    { name: "SMPS primary heatsink",               value: jitter(42, 5),  warning: 85,  critical: 95 },
  ].map((t) => ({
    ...t,
    unit: "°C",
    status: t.value >= t.critical ? "critical" : t.value >= t.warning ? "warning" : "ok",
  }));

  // Voltage sensors — names from SP4K-25B MIB walk, values in V
  // Real SNMP values are millivolts (×1000); thresholds are ±tolerance around nominal
  const voltages = [
    { name: "SMPS +12V",  value: jitter(11.94, 0.2),  nominal: 12.0,  tolerance: 0.6 },
    { name: "SMPS +24V",  value: jitter(24.12, 0.3),  nominal: 24.0,  tolerance: 1.2 },
    { name: "FMCB 5V",    value: jitter(5.0,   0.1),  nominal: 5.0,   tolerance: 0.25 },
    { name: "FMCB 12V",   value: jitter(11.9,  0.2),  nominal: 12.0,  tolerance: 0.6 },
    { name: "FMCB 24V",   value: jitter(23.8,  0.3),  nominal: 24.0,  tolerance: 1.2 },
    { name: "LDM 1 12V",  value: jitter(12.0,  0.2),  nominal: 12.0,  tolerance: 0.6 },
    { name: "LDM 1 24V",  value: jitter(24.7,  0.3),  nominal: 24.0,  tolerance: 1.2 },
    { name: "LDM 2 12V",  value: jitter(11.9,  0.2),  nominal: 12.0,  tolerance: 0.6 },
    { name: "LDM 2 24V",  value: jitter(25.0,  0.3),  nominal: 24.0,  tolerance: 1.2 },
    { name: "LCB 24V",    value: jitter(23.8,  0.3),  nominal: 24.0,  tolerance: 1.2 },
  ].map((v) => ({
    ...v,
    unit: "V",
    status: Math.abs(v.value - v.nominal) > v.tolerance ? "warning" : "ok",
  }));

  // Fan sensors — names and RPM ranges from real SP4K-25B MIB walk
  const fans = [
    { name: "Card cage inlet fan 1",          value: jitterInt(2539, 150), warning: 750 },
    { name: "Card cage inlet fan 2",          value: jitterInt(2503, 150), warning: 750 },
    { name: "Card cage outlet fan 1",         value: jitterInt(2548, 150), warning: 750 },
    { name: "LDM 1 fan 1",                    value: jitterInt(2461, 150), warning: 700 },
    { name: "LDM 1 fan 2",                    value: jitterInt(2476, 150), warning: 700 },
    { name: "LDM 2 fan 1",                    value: jitterInt(2498, 150), warning: 700 },
    { name: "LDM 2 fan 2",                    value: jitterInt(2429, 150), warning: 700 },
    { name: "Light processor fan",            value: jitterInt(2373, 150), warning: 600 },
    { name: "Blue formatter fan",             value: jitterInt(6464, 300), warning: 750 },
    { name: "Green formatter fan",            value: jitterInt(6413, 300), warning: 750 },
    { name: "Red formatter fan",              value: jitterInt(6340, 300), warning: 750 },
    { name: "SMPS fan",                       value: jitterInt(6262, 300), warning: 1500 },
    { name: "Light source cooling 1 fan 1",   value: jitterInt(3680, 200), warning: 1000 },
    { name: "Light source cooling 1 fan 2",   value: jitterInt(3776, 200), warning: 1000 },
    { name: "Light source cooling 2 fan 1",   value: jitterInt(3808, 200), warning: 1000 },
    { name: "Light source cooling 2 fan 2",   value: jitterInt(3744, 200), warning: 1000 },
    { name: "LSB 1 fan",                      value: jitterInt(5520, 300), warning: 1000 },
    { name: "Offstate heatsink fan 1",        value: jitterInt(5854, 300), warning: 750 },
  ].map((f) => ({
    ...f,
    unit: "RPM",
    status: f.value < f.warning ? "warning" : "ok",
  }));

  // Lamp/laser hours — real projectors report lamp runtime separately from total hours
  const lampHours = baseLampHours + Math.round(Date.now() / 3600000) % 100;

  // Alerts — UIDs and descriptions from real MIB walk data
  const errors = seed % 20 === 0
    ? [{ type: "E", uid: "E_LDM_001", description: "Light source drive module communication fault" }]
    : [];
  const warnings = seed % 7 === 0
    ? [{ type: "W", uid: "L8000a", description: "Illumination CLO unable to maintain desired light output" }]
    : [];

  const overallStatus =
    errors.length > 0 ? "error"
    : warnings.length > 0 || temperatures.some((t) => t.status !== "ok") || fans.some((f) => f.status !== "ok")
    ? "warning"
    : "ok";

  return {
    id: projConfig.id,
    name: projConfig.name,
    ip: projConfig.ip,
    model: MODELS[modelIndex],
    serial: `R9${String(seed * 7 + 100000).padStart(7, "0")}`,
    firmware: "1.8.13",
    state,
    laserPower: isOn ? clamp(jitter(baseLaserPower, 2), 0, 100) : 0,
    lampHours,
    lampHoursWarning: 10000,
    lampHoursEol: 15000,
    dowserOpen: isOn,
    health: { temperatures, voltages, fans, errors, warnings },
    status: overallStatus,
    polledAt: new Date().toISOString(),
  };
}

async function poll(projectors) {
  return projectors.map((p) => mockProjector(p));
}

module.exports = { poll };
