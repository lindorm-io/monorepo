import type { Answers, ProteusDriver, WorkerKey } from "./types.js";
import { PROTEUS_PRIMARY_PRIORITY } from "./types.js";

const pickPrimary = (drivers: ReadonlyArray<ProteusDriver>): ProteusDriver | null => {
  for (const d of PROTEUS_PRIMARY_PRIORITY) {
    if (drivers.includes(d)) return d;
  }
  return null;
};

const sourceImportPath = (drivers: ReadonlyArray<ProteusDriver>): string => {
  const nested = drivers.length > 1;
  if (!nested) return `../proteus/source.js`;
  const primary = pickPrimary(drivers);
  if (!primary) return `../proteus/source.js`;
  return `../proteus/${primary}/source.js`;
};

const amphoraEntitySync = (importPath: string): string =>
  [
    `import { createAmphoraEntityWorker } from "@lindorm/pylon";`,
    `import { amphora } from "../pylon/amphora.js";`,
    `import { logger } from "../logger/index.js";`,
    `import { source as proteusSource } from "${importPath}";`,
    ``,
    `export default createAmphoraEntityWorker({ amphora, logger, proteus: proteusSource });`,
    ``,
  ].join("\n");

const expiryCleanup = (importPath: string): string =>
  [
    `import { createExpiryCleanupWorker } from "@lindorm/pylon";`,
    `import { logger } from "../logger/index.js";`,
    `import { source as proteusSource } from "${importPath}";`,
    ``,
    `// TODO: add your entities with expiry fields to this array`,
    `export default createExpiryCleanupWorker({ logger, proteus: proteusSource, targets: [] });`,
    ``,
  ].join("\n");

const kryptosRotation = (importPath: string): string =>
  [
    `import { createKryptosRotationWorker } from "@lindorm/pylon";`,
    `import { logger } from "../logger/index.js";`,
    `import { source as proteusSource } from "${importPath}";`,
    ``,
    `export default createKryptosRotationWorker({ logger, proteus: proteusSource });`,
    ``,
  ].join("\n");

export const buildWorkerFile = (
  key: WorkerKey,
  answers: Pick<Answers, "proteusDrivers">,
): string => {
  const importPath = sourceImportPath(answers.proteusDrivers);
  switch (key) {
    case "amphora-entity-sync":
      return amphoraEntitySync(importPath);
    case "expiry-cleanup":
      return expiryCleanup(importPath);
    case "kryptos-rotation":
      return kryptosRotation(importPath);
  }
};
