import type { WorkerKey } from "./types.js";

const SOURCE_IMPORT = "../proteus/source.js";

const amphoraEntitySync = (): string =>
  [
    `import { createAmphoraEntityWorker } from "@lindorm/pylon";`,
    `import { amphora } from "../pylon/amphora.js";`,
    `import { logger } from "../logger/index.js";`,
    `import { source as proteusSource } from "${SOURCE_IMPORT}";`,
    ``,
    `export default createAmphoraEntityWorker({ amphora, logger, proteus: proteusSource });`,
    ``,
  ].join("\n");

const expiryCleanup = (): string =>
  [
    `import { createExpiryCleanupWorker } from "@lindorm/pylon";`,
    `import { logger } from "../logger/index.js";`,
    `import { source as proteusSource } from "${SOURCE_IMPORT}";`,
    ``,
    `// TODO: add your entities with expiry fields to this array`,
    `export default createExpiryCleanupWorker({ logger, proteus: proteusSource, targets: [] });`,
    ``,
  ].join("\n");

const kryptosRotation = (): string =>
  [
    `import { createKryptosRotationWorker } from "@lindorm/pylon";`,
    `import { amphora } from "../pylon/amphora.js";`,
    `import { logger } from "../logger/index.js";`,
    `import { source as proteusSource } from "${SOURCE_IMPORT}";`,
    ``,
    // Pass the amphora so freshly-minted keys land in the vault immediately
    // (JWKS is populated on first boot, not after the next entity-sync tick).
    `export default createKryptosRotationWorker({ amphora, logger, proteus: proteusSource });`,
    ``,
  ].join("\n");

export const buildWorkerFile = (key: WorkerKey): string => {
  switch (key) {
    case "amphora-entity-sync":
      return amphoraEntitySync();
    case "expiry-cleanup":
      return expiryCleanup();
    case "kryptos-rotation":
      return kryptosRotation();
  }
};
