"use strict";

const http = require("http");

const PORT = process.env.PORT ?? 4000;
const API_KEY = process.env.RELAY_API_KEY ?? "";

// In-memory store: siteId → latest site payload
const store = new Map();

// Seed with mock data so the dashboard works before any relay connects
function seedMockData() {
  const now = new Date().toISOString();
  const sites = [
    {
      siteId: "site-001",
      siteName: "Westgate Cinema",
      projectors: mockProjectors("site-001", 3),
      reportedAt: now,
    },
    {
      siteId: "site-002",
      siteName: "Northpark Cinemas",
      projectors: mockProjectors("site-002", 2),
      reportedAt: now,
    },
  ];
  sites.forEach((s) => store.set(s.siteId, s));
  console.log(`Seeded ${sites.length} mock sites.`);
}

function mockProjectors(siteId, count) {
  const MODELS = ["Barco SP4K-25B", "Barco DP4K-32B", "Barco SP4K-15C"];
  const STATES = ["on", "on", "on", "standby"];
  return Array.from({ length: count }, (_, i) => {
    const seed = siteId.charCodeAt(5) * 10 + i;
    const isOn = STATES[seed % STATES.length] === "on";
    return {
      id: `${siteId}-aud-${i + 1}`,
      name: `Auditorium ${i + 1}`,
      ip: `192.168.10.${10 + i}`,
      model: MODELS[seed % MODELS.length],
      serial: `R9${String(seed * 7 + 100000).padStart(7, "0")}`,
      firmware: "1.8.13",
      state: STATES[seed % STATES.length],
      laserPower: isOn ? 85 + i : 0,
      lampHours: 1022 + seed * 200,
      lampHoursWarning: 10000,
      lampHoursEol: 15000,
      dowserOpen: isOn,
      health: {
        temperatures: [
          { name: "Front air inlet",          value: 22 + i,      warning: 45,  critical: 55,  unit: "°C", status: "ok" },
          { name: "FMCB board",               value: 28 + i,      warning: 80,  critical: 85,  unit: "°C", status: "ok" },
          { name: "CCB CPU",                  value: 39 + i,      warning: 90,  critical: 100, unit: "°C", status: "ok" },
          { name: "LDM 1 main board",         value: 28 + i,      warning: 52,  critical: 55,  unit: "°C", status: "ok" },
          { name: "LDM 1 main board heatsink",value: 45 + i,      warning: 95,  critical: 100, unit: "°C", status: "ok" },
          { name: "Light source cooling inlet",value: 22,         warning: 65,  critical: 75,  unit: "°C", status: "ok" },
          { name: "ICMP/ICP-D - Environment", value: 47 + i,      warning: 255, critical: 255, unit: "°C", status: "ok" },
          { name: "Blue DMD front",           value: 37 + i,      warning: 60,  critical: 65,  unit: "°C", status: "ok" },
          { name: "Green DMD front",          value: 37 + i,      warning: 60,  critical: 65,  unit: "°C", status: "ok" },
          { name: "Red DMD front",            value: 35 + i,      warning: 60,  critical: 65,  unit: "°C", status: "ok" },
        ],
        voltages: [
          { name: "SMPS +12V",  value: 11.94, nominal: 12.0, tolerance: 0.6,  unit: "V", status: "ok" },
          { name: "SMPS +24V",  value: 24.12, nominal: 24.0, tolerance: 1.2,  unit: "V", status: "ok" },
          { name: "FMCB 5V",   value: 5.01,  nominal: 5.0,  tolerance: 0.25, unit: "V", status: "ok" },
          { name: "FMCB 12V",  value: 11.9,  nominal: 12.0, tolerance: 0.6,  unit: "V", status: "ok" },
          { name: "LDM 1 12V", value: 12.0,  nominal: 12.0, tolerance: 0.6,  unit: "V", status: "ok" },
          { name: "LDM 1 24V", value: 24.7,  nominal: 24.0, tolerance: 1.2,  unit: "V", status: "ok" },
        ],
        fans: [
          { name: "Card cage inlet fan 1",         value: 2539, warning: 750,  unit: "RPM", status: "ok" },
          { name: "Card cage inlet fan 2",         value: 2503, warning: 750,  unit: "RPM", status: "ok" },
          { name: "LDM 1 fan 1",                   value: 2461, warning: 700,  unit: "RPM", status: "ok" },
          { name: "LDM 2 fan 1",                   value: 2498, warning: 700,  unit: "RPM", status: "ok" },
          { name: "Blue formatter fan",            value: 6464, warning: 750,  unit: "RPM", status: "ok" },
          { name: "SMPS fan",                      value: 6262, warning: 1500, unit: "RPM", status: "ok" },
          { name: "Light source cooling 1 fan 1",  value: 3680, warning: 1000, unit: "RPM", status: "ok" },
          { name: "Light source cooling 2 fan 1",  value: 3808, warning: 1000, unit: "RPM", status: "ok" },
        ],
        errors: [],
        warnings: seed % 3 === 0
          ? [{ type: "W", uid: "L8000a", description: "Illumination CLO unable to maintain desired light output" }]
          : [],
      },
      status: seed % 3 === 0 ? "warning" : "ok",
      polledAt: now,
    };
  });
}

function respond(res, status, body) {
  const json = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
  res.end(json);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      try { resolve(JSON.parse(raw)); } catch { reject(new Error("Invalid JSON")); }
    });
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // POST /api/data — receive data from a site relay
  if (req.method === "POST" && url.pathname === "/api/data") {
    if (API_KEY && req.headers["x-api-key"] !== API_KEY) {
      return respond(res, 401, { error: "Unauthorized" });
    }
    try {
      const payload = await readBody(req);
      if (!payload.siteId) return respond(res, 400, { error: "Missing siteId" });
      store.set(payload.siteId, { ...payload, receivedAt: new Date().toISOString() });
      console.log(`[${new Date().toISOString()}] Received data from ${payload.siteName} (${payload.siteId}) — ${payload.projectors?.length ?? 0} projector(s)`);
      return respond(res, 200, { ok: true });
    } catch (err) {
      return respond(res, 400, { error: err.message });
    }
  }

  // GET /api/status — return all sites for the website
  if (req.method === "GET" && url.pathname === "/api/status") {
    const sites = Array.from(store.values());
    return respond(res, 200, { sites, asOf: new Date().toISOString() });
  }

  // GET /api/status/:siteId — single site
  if (req.method === "GET" && url.pathname.startsWith("/api/status/")) {
    const siteId = url.pathname.replace("/api/status/", "");
    const site = store.get(siteId);
    if (!site) return respond(res, 404, { error: "Site not found" });
    return respond(res, 200, site);
  }

  respond(res, 404, { error: "Not found" });
});

seedMockData();
server.listen(PORT, () => {
  console.log(`SCS Central Relay listening on port ${PORT}`);
});
