import process from "node:process";

const chunks = [];

for await (const chunk of process.stdin) {
  chunks.push(chunk);
}

const output = Buffer.concat(chunks).toString("utf8");

const failures = [];

if (/Failed to set Next\.js data cache/.test(output)) {
  failures.push("build emitted a Next.js data cache failure");
}

if (/items over 2MB can not be cached/.test(output)) {
  failures.push("build tried to cache a payload larger than 2MB");
}

if (/^\s*[├└] ƒ \/explore\b/m.test(output)) {
  failures.push("/explore is no longer static in the production build");
}

if (!/^\s*[├└] ○ \/explore\b/m.test(output)) {
  failures.push("build output did not confirm a static /explore route");
}

if (/^\s*[├└] ƒ \/$/m.test(output)) {
  failures.push("/ is no longer static in the production build");
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`budget-check: ${failure}`);
  }
  process.exit(1);
}

console.log("budget-check: build output passed Vercel budget guardrails");
