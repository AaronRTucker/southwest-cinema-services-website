"use strict";

// Real Barco Series 4 REST API driver
// Replace mock.js with this once site relay is deployed at a cinema location

const { fetch } = require("node-fetch");

function authHeader(user, password) {
  return "Basic " + Buffer.from(`${user}:${password}`).toString("base64");
}

async function get(ip, path, user, password) {
  const res = await fetch(`http://${ip}${path}`, {
    headers: { Authorization: authHeader(user, password) },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json();
}

async function pollOne(proj) {
  const { ip, restUser: user, restPassword: password } = proj;
  const [state, ident, laserPower] = await Promise.all([
    get(ip, "/rest/system/state", user, password),
    get(ip, "/rest/system/getidentifications", user, password),
    get(ip, "/rest/illumination/sources/laser/actualpower", user, password),
  ]);
  return {
    id: proj.id,
    name: proj.name,
    ip,
    model: ident?.ProductLine ?? "Barco",
    serial: ident?.SerialNumber ?? "",
    firmware: ident?.version ?? "",
    state: state?.value ?? "unknown",
    laserPower: laserPower?.value ?? 0,
    polledAt: new Date().toISOString(),
  };
}

async function poll(projectors) {
  return Promise.all(
    projectors.map((p) =>
      pollOne(p).catch((err) => ({
        id: p.id,
        name: p.name,
        ip: p.ip,
        state: "unreachable",
        error: err.message,
        polledAt: new Date().toISOString(),
      }))
    )
  );
}

module.exports = { poll };
