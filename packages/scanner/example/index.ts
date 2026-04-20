/**
 * Scanner showcase — runs outside Jest so the native ESM path is exercised
 * without --experimental-vm-modules or ts-jest's CJS-to-ESM double-wrap.
 *
 * Run with:  npm run example
 *
 * Demonstrates:
 *   1. Directory walking via scan()
 *   2. Async file loading via import() (native dynamic import)
 *   3. That class identity is preserved across the async import boundary —
 *      an instance exported from a scanned file is instanceof the class
 *      imported by the caller.
 */

import { Scanner } from "../src";
import { WorkerBrand } from "./worker-a";

// Scan only the two worker demo files sitting alongside this entry point —
// ignore index.ts itself and the unrelated `files/` scanner test fixtures.
const scanner = new Scanner({
  deniedFilenames: [/^index$/],
  deniedDirectories: [/^files$/],
  deniedTypes: [/^fixture$/, /^test$/],
});

const tree = scanner.scan(__dirname);
const flat = Scanner.flatten(tree);

console.log(`\nscanned ${flat.length} file(s):`);
for (const f of flat) {
  console.log(`  - ${f.relativePath}`);
}

const workerA = flat.find((f) => f.baseName === "worker-a");
const workerB = flat.find((f) => f.baseName === "worker-b");

if (!workerA || !workerB) {
  throw new Error("example fixtures missing");
}

(async () => {
  const moduleA = await scanner.import<any>(workerA);

  console.log("\nworker-a (named exports):", {
    keys: Object.keys(moduleA),
    INTERVAL: moduleA.INTERVAL,
    brandCtor: moduleA.brand?.constructor?.name,
    brandIsInstance: moduleA.brand instanceof WorkerBrand,
  });

  const moduleB = await scanner.import<any>(workerB);

  console.log("\nworker-b (default export):", {
    keys: Object.keys(moduleB),
    defaultCtor: moduleB.default?.constructor?.name,
    defaultIsInstance: moduleB.default instanceof WorkerBrand,
    defaultAlias: moduleB.default?.alias,
  });
})().catch((err) => {
  console.error("example failed:", err);
  process.exit(1);
});
