"use strict";

const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const WebSocket = require("ws");

// ── Config ────────────────────────────────────────────────────────────────────

const configPath = fs.existsSync(path.join(__dirname, "config.json"))
  ? path.join(__dirname, "config.json")
  : path.join(__dirname, "config.example.json");

const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

const HEARTBEAT_MS = (config.heartbeatSeconds ?? 30) * 1000;
const POLL_MS = (config.pollIntervalSeconds ?? 30) * 1000;
const VERSION = "2.0.0";

// ── Driver ────────────────────────────────────────────────────────────────────

const driver = (() => {
  try {
    return require(`./drivers/${config.driver ?? "mock"}.js`);
  } catch {
    console.warn(`Driver "${config.driver}" not found, falling back to mock.`);
    return require("./drivers/mock.js");
  }
})();

// ── Helpers ───────────────────────────────────────────────────────────────────

function toWsUrl(httpUrl) {
  return httpUrl.replace(/^http:\/\//, "ws://").replace(/^https:\/\//, "wss://");
}

function buildWsUrl() {
  const base = `${toWsUrl(config.centralRelayUrl)}/ws`;
  const params = new URLSearchParams({ siteId: config.siteId });
  if (config.apiKey) params.set("key", config.apiKey);
  return `${base}?${params}`;
}

// ── Commands ──────────────────────────────────────────────────────────────────

function pingHost(target) {
  return new Promise((resolve) => {
    const isWindows = process.platform === "win32";
    const cmd = isWindows
      ? `ping -n 1 -w 2000 ${target}`
      : `ping -c 1 -W 2 ${target}`;

    exec(cmd, { timeout: 8000 }, (error, stdout) => {
      const output = (stdout ?? "").trim();
      if (error && !output) {
        return resolve({ alive: false, ms: null, output: error.message });
      }
      const match = output.match(/[Tt]ime[=<](\d+\.?\d*)\s*ms/);
      const ms = match ? parseFloat(match[1]) : null;
      resolve({ alive: !error, ms, output });
    });
  });
}

async function handleCommand(msg, ws) {
  const { commandId, command, params } = msg;
  let ok = false;
  let data = null;
  let error = null;

  try {
    if (command === "ping") {
      if (!params?.target) throw new Error("Missing target");
      data = await pingHost(params.target);
      ok = true;
    } else {
      throw new Error(`Unknown command: ${command}`);
    }
  } catch (err) {
    error = err.message;
  }

  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "result", commandId, ok, data, error }));
  }
}

// ── Projector polling ─────────────────────────────────────────────────────────

async function pollAndPush(ws) {
  if (!config.projectors?.length) return;
  const ts = new Date().toISOString();
  try {
    const projectors = await driver.poll(config.projectors);
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "data", siteId: config.siteId, projectors, ts }));
      console.log(`[${ts}] Pushed ${projectors.length} projector(s)`);
    }
  } catch (err) {
    console.error(`[${ts}] Poll error:`, err.message);
  }
}

// ── WebSocket connection ──────────────────────────────────────────────────────

let reconnectDelay = 2000;
let heartbeatTimer = null;
let pollTimer = null;

function connect() {
  const wsUrl = buildWsUrl();
  console.log(`[${new Date().toISOString()}] Connecting...`);
  const ws = new WebSocket(wsUrl);

  ws.on("open", () => {
    reconnectDelay = 2000;
    console.log(`[${new Date().toISOString()}] Connected to central relay.`);

    ws.send(JSON.stringify({ type: "hello", siteId: config.siteId, siteName: config.siteName, version: VERSION }));

    heartbeatTimer = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "heartbeat", siteId: config.siteId, ts: new Date().toISOString() }));
      }
    }, HEARTBEAT_MS);

    pollAndPush(ws);
    pollTimer = setInterval(() => pollAndPush(ws), POLL_MS);
  });

  ws.on("message", (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    if (msg.type === "command") handleCommand(msg, ws);
  });

  ws.on("close", (code, reason) => {
    clearInterval(heartbeatTimer);
    clearInterval(pollTimer);
    const r = reason?.toString() || code;
    console.log(`[${new Date().toISOString()}] Disconnected (${r}). Reconnecting in ${reconnectDelay / 1000}s...`);
    setTimeout(connect, reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 2, 30000);
  });

  ws.on("error", (err) => {
    // close event will fire next and handle reconnect
    console.error(`[${new Date().toISOString()}] Error:`, err.message);
  });
}

// ── Start ─────────────────────────────────────────────────────────────────────

console.log(`SCS Site Relay v${VERSION}`);
console.log(`Site:          ${config.siteName} (${config.siteId})`);
console.log(`Driver:        ${config.driver ?? "mock"}`);
console.log(`Heartbeat:     ${config.heartbeatSeconds ?? 30}s`);
console.log(`Poll interval: ${config.pollIntervalSeconds ?? 30}s`);
console.log(`Central relay: ${config.centralRelayUrl}`);

connect();
