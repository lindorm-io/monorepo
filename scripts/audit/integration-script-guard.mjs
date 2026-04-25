#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("../../packages", import.meta.url).pathname;

const findIntegrationTests = (dir) => {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...findIntegrationTests(full));
    } else if (entry.isFile() && entry.name.endsWith(".integration.test.ts")) {
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
  let tests = [];
  try {
    tests = findIntegrationTests(srcDir);
  } catch {
    continue;
  }
  if (tests.length === 0) continue;

  const pkgJsonPath = join(pkgDir, "package.json");
  const pkgJson = JSON.parse(readFileSync(pkgJsonPath, "utf8"));
  const hasScript = Boolean(pkgJson.scripts?.["test:integration"]);

  if (!hasScript) {
    violations.push({ pkg: name, count: tests.length, sample: tests[0] });
  }
}

if (violations.length > 0) {
  console.error("integration-script-guard: packages with *.integration.test.ts but no test:integration script:");
  for (const v of violations) {
    console.error(`  - ${v.pkg} (${v.count} files, e.g. ${v.sample.replace(ROOT + "/", "")})`);
  }
  console.error("\nAdd to each package.json:");
  console.error('  "test:integration": "vitest run \'integration.test\'"');
  process.exit(1);
}

console.log(`integration-script-guard: ok (${packages.length} packages scanned)`);
