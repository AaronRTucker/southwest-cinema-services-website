"use strict";

const snmp = require("net-snmp");

async function walkOid(session, root) {
  return new Promise((resolve) => {
    const results = [];
    session.walk(
      root,
      20, // maxRepetitions
      (varbinds) => {
        for (const vb of varbinds) {
          if (snmp.isVarbindError(vb)) continue;
          let display = vb.value;
          if (Buffer.isBuffer(vb.value)) {
            const ascii = vb.value.toString("ascii").replace(/[^\x20-\x7E]/g, ".");
            const hex = vb.value.toString("hex");
            display = ascii.replace(/\./g, "").length > hex.length / 4 ? ascii : hex;
          }
          results.push({
            oid: vb.oid,
            type: snmp.ObjectType[vb.type] ?? vb.type,
            value: display,
          });
        }
      },
      (err) => {
        if (err) console.error(`  Walk error on ${root}: ${err.message}`);
        resolve(results);
      }
    );
  });
}

async function run(ip, community = "public") {
  console.log(`\nSNMP Walk`);
  console.log(`  Target:    ${ip}`);
  console.log(`  Community: ${community}`);
  console.log(`  Port:      161 (UDP)\n`);

  // Quick connectivity test: GET sysDescr before doing a full walk
  console.log("Testing connectivity (GET sysDescr)...");
  for (const version of [snmp.Version2c, snmp.Version1]) {
    const label = version === snmp.Version2c ? "v2c" : "v1";
    const testSession = snmp.createSession(ip, community, { version, timeout: 4000, retries: 1 });
    const reachable = await new Promise((resolve) => {
      testSession.get(["1.3.6.1.2.1.1.1.0"], (err, vbs) => {
        testSession.close();
        if (err) { console.log(`  SNMP ${label}: ${err.message}`); resolve(false); }
        else { console.log(`  SNMP ${label}: OK — ${vbs[0]?.value?.toString?.() ?? "(no value)"}`); resolve(true); }
      });
    });
    if (reachable) break;
  }
  console.log();

  const session = snmp.createSession(ip, community, {
    version: snmp.Version2c,
    timeout: 5000,
    retries: 1,
  });

  // Walk standard system MIB + full Barco enterprise tree
  const roots = [
    "1.3.6.1.2.1.1",      // Standard sysDescr, sysName, etc.
    "1.3.6.1.4.1.25469",  // Barco enterprise OID
  ];

  let total = 0;
  for (const root of roots) {
    console.log(`--- ${root} ---`);
    const results = await walkOid(session, root);
    if (results.length === 0) {
      console.log("  (no results — check community string and that SNMP is enabled)");
    } else {
      for (const r of results) {
        console.log(`  ${r.oid}  [${r.type}]  ${r.value}`);
      }
      total += results.length;
    }
    console.log();
  }

  session.close();
  console.log(`Walk complete — ${total} OID(s) found.`);
  process.exit(0);
}

module.exports = { run };
