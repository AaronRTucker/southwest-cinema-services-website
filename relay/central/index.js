"use strict";

const http = require("http");
const { WebSocketServer, WebSocket } = require("ws");
const { randomUUID } = require("crypto");

const PORT = process.env.PORT ?? 4000;
const API_KEY = process.env.RELAY_API_KEY ?? "";

// siteId → latest site data
const store = new Map();

// siteId → active WebSocket
const connections = new Map();

// commandId → { resolve, reject, timer }
const pending = new Map();

function respond(res, status, body) {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, x-api-key",
  });
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

function checkKey(req) {
  return !API_KEY || req.headers["x-api-key"] === API_KEY;
}

function siteIsOnline(siteId) {
  const ws = connections.get(siteId);
  return ws?.readyState === WebSocket.OPEN;
}

// Send a command to a site relay and await its result (up to timeoutMs)
function sendCommand(siteId, command, params, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const ws = connections.get(siteId);
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return reject(new Error("Site relay not connected"));
    }
    const commandId = randomUUID();
    const timer = setTimeout(() => {
      pending.delete(commandId);
      reject(new Error("Command timed out"));
    }, timeoutMs);
    pending.set(commandId, { resolve, reject, timer });
    ws.send(JSON.stringify({ type: "command", commandId, command, params }));
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (req.method === "OPTIONS") {
    res.writeHead(204, { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST", "Access-Control-Allow-Headers": "Content-Type, x-api-key" });
    return res.end();
  }

  // POST /api/data — legacy HTTP push (kept for compatibility)
  if (req.method === "POST" && url.pathname === "/api/data") {
    if (!checkKey(req)) return respond(res, 401, { error: "Unauthorized" });
    try {
      const payload = await readBody(req);
      if (!payload.siteId) return respond(res, 400, { error: "Missing siteId" });
      const existing = store.get(payload.siteId) ?? {};
      store.set(payload.siteId, { ...existing, ...payload, receivedAt: new Date().toISOString() });
      console.log(`[${new Date().toISOString()}] HTTP data: ${payload.siteName ?? payload.siteId} — ${payload.projectors?.length ?? 0} projector(s)`);
      return respond(res, 200, { ok: true });
    } catch (err) {
      return respond(res, 400, { error: err.message });
    }
  }

  // POST /api/command — send a command to a connected site relay
  if (req.method === "POST" && url.pathname === "/api/command") {
    if (!checkKey(req)) return respond(res, 401, { error: "Unauthorized" });
    try {
      const { siteId, command, params } = await readBody(req);
      if (!siteId || !command) return respond(res, 400, { error: "Missing siteId or command" });
      const data = await sendCommand(siteId, command, params ?? {});
      return respond(res, 200, { ok: true, data });
    } catch (err) {
      return respond(res, 500, { ok: false, error: err.message });
    }
  }

  // GET /api/status — all sites
  if (req.method === "GET" && url.pathname === "/api/status") {
    const sites = Array.from(store.values()).map((s) => ({
      ...s,
      online: siteIsOnline(s.siteId),
    }));
    return respond(res, 200, { sites, asOf: new Date().toISOString() });
  }

  // GET /api/status/:siteId
  if (req.method === "GET" && url.pathname.startsWith("/api/status/")) {
    const siteId = url.pathname.replace("/api/status/", "");
    const site = store.get(siteId);
    if (!site) return respond(res, 404, { error: "Site not found" });
    return respond(res, 200, { ...site, online: siteIsOnline(siteId) });
  }

  respond(res, 404, { error: "Not found" });
});

// WebSocket server on same port, path /ws
const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (ws, req) => {
  const url = new URL(req.url, "http://localhost");
  const siteId = url.searchParams.get("siteId");
  const key = url.searchParams.get("key");

  if (API_KEY && key !== API_KEY) { ws.close(1008, "Unauthorized"); return; }
  if (!siteId) { ws.close(1008, "Missing siteId"); return; }

  // Replace any existing connection for this site
  const prev = connections.get(siteId);
  if (prev?.readyState === WebSocket.OPEN) prev.close();

  connections.set(siteId, ws);
  const existing = store.get(siteId) ?? {};
  store.set(siteId, { ...existing, siteId, online: true, connectedAt: new Date().toISOString() });
  console.log(`[${new Date().toISOString()}] Connected: ${siteId}`);

  ws.on("message", (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    const now = new Date().toISOString();
    const current = store.get(siteId) ?? { siteId };

    switch (msg.type) {
      case "hello":
        store.set(siteId, { ...current, siteName: msg.siteName, version: msg.version, online: true });
        console.log(`[${now}] Hello from ${msg.siteName ?? siteId} v${msg.version ?? "?"}`);
        break;
      case "heartbeat":
        store.set(siteId, { ...current, lastHeartbeat: now });
        break;
      case "data":
        store.set(siteId, { ...current, projectors: msg.projectors, reportedAt: now, receivedAt: now });
        console.log(`[${now}] Data from ${siteId} — ${msg.projectors?.length ?? 0} projector(s)`);
        break;
      case "result": {
        const p = pending.get(msg.commandId);
        if (p) {
          clearTimeout(p.timer);
          pending.delete(msg.commandId);
          if (msg.ok) p.resolve(msg.data);
          else p.reject(new Error(msg.error ?? "Command failed"));
        }
        break;
      }
    }
  });

  ws.on("close", () => {
    connections.delete(siteId);
    const current = store.get(siteId);
    if (current) store.set(siteId, { ...current, online: false, disconnectedAt: new Date().toISOString() });
    console.log(`[${new Date().toISOString()}] Disconnected: ${siteId}`);
  });

  ws.on("error", (err) => console.error(`[WS error] ${siteId}:`, err.message));
});

server.listen(PORT, () => {
  console.log(`SCS Central Relay on :${PORT} (HTTP + WebSocket)`);
  if (API_KEY) console.log("API key authentication enabled.");
});
