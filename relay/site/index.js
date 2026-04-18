"use strict";

const fs = require("fs");
const path = require("path");
const http = require("http");
const https = require("https");

// Load config — use config.json if present, else config.example.json
const configPath = fs.existsSync(path.join(__dirname, "config.json"))
  ? path.join(__dirname, "config.json")
  : path.join(__dirname, "config.example.json");

const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
const driver = require(`./drivers/${config.driver ?? "mock"}.js`);

const INTERVAL_MS = (config.pollIntervalSeconds ?? 30) * 1000;

function postJSON(url, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const parsed = new URL(url);
    const lib = parsed.protocol === "https:" ? https : http;
    const req = lib.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
        path: parsed.pathname,
        method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) },
        timeout: 10000,
      },
      (res) => {
        let raw = "";
        res.on("data", (c) => (raw += c));
        res.on("end", () => resolve({ status: res.statusCode, body: raw }));
      }
    );
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
    req.write(data);
    req.end();
  });
}

async function runPoll() {
  const ts = new Date().toISOString();
  console.log(`[${ts}] Polling ${config.projectors.length} projector(s)...`);

  let projectors;
  try {
    projectors = await driver.poll(config.projectors);
  } catch (err) {
    console.error(`[${ts}] Driver error:`, err.message);
    return;
  }

  const payload = {
    siteId: config.siteId,
    siteName: config.siteName,
    projectors,
    reportedAt: ts,
  };

  try {
    const result = await postJSON(`${config.centralRelayUrl}/api/data`, payload);
    console.log(`[${ts}] → Central relay: ${result.status}`);
  } catch (err) {
    console.error(`[${ts}] Failed to reach central relay:`, err.message);
  }
}

console.log(`SCS Site Relay starting — site: ${config.siteName} (${config.siteId})`);
console.log(`Driver: ${config.driver ?? "mock"} | Interval: ${config.pollIntervalSeconds ?? 30}s`);
console.log(`Central relay: ${config.centralRelayUrl}`);

runPoll();
setInterval(runPoll, INTERVAL_MS);
