#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("../../packages", import.meta.url).pathname;

// Cadence-driven test selection: file suffix → matching package script.
const CADENCES = ["integration", "weekly", "daily"];

const findTestsByCadence = (dir, cadence) => {
  const suffix = `.${cadence}.test.ts`;
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...findTestsByCadence(full, cadence));
    } else if (entry.isFile() && entry.name.endsWith(suffix)) {
      out.push(full);
    }
  }
  return out;
};

const packages = readdirSync(ROOT).filter((name) => {
  try {
    return statSync(join(ROOT, name)).isDirectory();
  } catch {
    return false;
  }
});

const violations = [];

for (const name of packages) {
  const pkgDir = join(ROOT, name);
  const srcDir = join(pkgDir, "src");
  const pkgJsonPath = join(pkgDir, "package.json");
  let pkgJson;
  try {
    pkgJson = JSON.parse(readFileSync(pkgJsonPath, "utf8"));
  } catch {
    continue;
  }

  for (const cadence of CADENCES) {
    let tests = [];
    try {
      tests = findTestsByCadence(srcDir, cadence);
    } catch {
      continue;
    }
    if (tests.length === 0) continue;

    const scriptName = `test:${cadence}`;
    if (!pkgJson.scripts?.[scriptName]) {
      violations.push({ pkg: name, cadence, count: tests.length, sample: tests[0] });
    }
  }
}

if (violations.length > 0) {
  console.error("cadence-script-guard: packages with cadence-tagged test files but no matching script:");
  for (const v of violations) {
    console.error(
      `  - ${v.pkg} → missing test:${v.cadence} (${v.count} *.${v.cadence}.test.ts files, e.g. ${v.sample.replace(ROOT + "/", "")})`,
    );
  }
  console.error("\nAdd to each package.json the matching script, e.g.:");
  console.error('  "test:integration": "vitest run --config vitest.integration.mjs"');
  process.exit(1);
}

console.log(`cadence-script-guard: ok (${packages.length} packages scanned)`);
