import type { WorkerKey } from "./types.js";

const SOURCE_IMPORT = "../proteus/source.js";

const amphoraEntitySync = (dbDriver: string): string =>
  [
    `import { createAmphoraEntityWorker } from "@lindorm/pylon";`,
    `import { amphora } from "../pylon/amphora.js";`,
    `import { logger } from "../logger/index.js";`,
    `import { ${dbDriver} } from "${SOURCE_IMPORT}";`,
    ``,
    `export default createAmphoraEntityWorker({ amphora, logger, db: ${dbDriver} });`,
    ``,
  ].join("\n");

const expiryCleanup = (dbDriver: string): string =>
  [
    `import { createExpiryCleanupWorker } from "@lindorm/pylon";`,
    `import { logger } from "../logger/index.js";`,
    `import { ${dbDriver} } from "${SOURCE_IMPORT}";`,
    ``,
    `// TODO: add your entities with expiry fields to this array`,
    `export default createExpiryCleanupWorker({ logger, db: ${dbDriver}, targets: [] });`,
    ``,
  ].join("\n");

const certificateExpiry = (): string =>
  [
    `import { createCertificateExpiryWorker } from "@lindorm/pylon";`,
    `import { amphora } from "../pylon/amphora.js";`,
    `import { logger } from "../logger/index.js";`,
    ``,
    // Monitors the certificate chains of vault keys (leaf + issuing/root CA)
    // and logs warn/error as they approach expiry. Needs no db.
    `export default createCertificateExpiryWorker({ amphora, logger });`,
    ``,
  ].join("\n");

const kryptosRotation = (dbDriver: string): string =>
  [
    `import { createKryptosRotationWorker } from "@lindorm/pylon";`,
    `import { amphora } from "../pylon/amphora.js";`,
    `import { logger } from "../logger/index.js";`,
    `import { ${dbDriver} } from "${SOURCE_IMPORT}";`,
    ``,
    // Pass the amphora so freshly-minted keys land in the vault immediately
    // (JWKS is populated on first boot, not after the next entity-sync tick).
    `export default createKryptosRotationWorker({ amphora, logger, db: ${dbDriver} });`,
    ``,
  ].join("\n");

export const buildWorkerFile = (key: WorkerKey, dbDriver: string): string => {
  switch (key) {
    case "amphora-entity-sync":
      return amphoraEntitySync(dbDriver);
    case "certificate-expiry":
      return certificateExpiry();
    case "expiry-cleanup":
      return expiryCleanup(dbDriver);
    case "kryptos-rotation":
      return kryptosRotation(dbDriver);
  }
};
