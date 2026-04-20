/**
 * Scanner showcase — runs outside Jest so the native ESM path is exercised
 * without --experimental-vm-modules or ts-jest's CJS-to-ESM double-wrap.
 *
 * Run with:  npm run example
 *
 * Demonstrates:
 *   1. Directory walking via scan()
 *   2. Sync file loading via require() (the current CJS path, via tsx/cjs/api)
 *   3. Async file loading via import() (native dynamic import)
 *   4. That the same file loaded via either path yields equivalent values
 *   5. That class identity survives the async import boundary
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

// sync require
const syncModule = scanner.require<any>(workerA);

console.log("\nsync require — worker-a:", {
  keys: Object.keys(syncModule),
  INTERVAL: syncModule.INTERVAL,
  brandCtor: syncModule.brand?.constructor?.name,
  brandIsInstance: syncModule.brand instanceof WorkerBrand,
});

// async native import
(async () => {
  const asyncA = await scanner.import<any>(workerA);

  console.log("\nasync import — worker-a:", {
    keys: Object.keys(asyncA),
    INTERVAL: asyncA.INTERVAL,
    brandCtor: asyncA.brand?.constructor?.name,
    brandIsInstance: asyncA.brand instanceof WorkerBrand,
  });

  const asyncB = await scanner.import<any>(workerB);

  console.log("\nasync import — worker-b (default export):", {
    keys: Object.keys(asyncB),
    defaultCtor: asyncB.default?.constructor?.name,
    defaultIsInstance: asyncB.default instanceof WorkerBrand,
    defaultAlias: asyncB.default?.alias,
  });

  // Equivalence between the two load paths for the same file.

  console.log("\nidentity across sync and async:", {
    sameBrandInstance: syncModule.brand === asyncA.brand,
    sameClass: syncModule.brand?.constructor === asyncA.brand?.constructor,
    bothMatchImportedClass:
      syncModule.brand instanceof WorkerBrand && asyncA.brand instanceof WorkerBrand,
  });
})().catch((err) => {
  console.error("example failed:", err);
  process.exit(1);
});
