import type { WorkerKey } from "./types";

const amphoraRefresh = (): string =>
  [
    `import { createAmphoraRefreshWorker } from "@lindorm/pylon";`,
    `import { amphora } from "../pylon/amphora";`,
    ``,
    `export default createAmphoraRefreshWorker({ amphora });`,
    ``,
  ].join("\n");

const amphoraEntitySync = (): string =>
  [
    `import { createAmphoraEntityWorker } from "@lindorm/pylon";`,
    `import { amphora } from "../pylon/amphora";`,
    `import { source as proteusSource } from "../proteus/source";`,
    ``,
    `export default createAmphoraEntityWorker({ amphora, proteus: proteusSource });`,
    ``,
  ].join("\n");

const expiryCleanup = (): string =>
  [
    `import { createExpiryCleanupWorker } from "@lindorm/pylon";`,
    `import { source as proteusSource } from "../proteus/source";`,
    ``,
    `// TODO: add your entities with expiry fields to this array`,
    `export default createExpiryCleanupWorker({ proteus: proteusSource, targets: [] });`,
    ``,
  ].join("\n");

const kryptosRotation = (): string =>
  [
    `import { createKryptosRotationWorker } from "@lindorm/pylon";`,
    `import { source as proteusSource } from "../proteus/source";`,
    ``,
    `export default createKryptosRotationWorker({ proteus: proteusSource });`,
    ``,
  ].join("\n");

export const buildWorkerFile = (key: WorkerKey): string => {
  switch (key) {
    case "amphora-refresh":
      return amphoraRefresh();
    case "amphora-entity-sync":
      return amphoraEntitySync();
    case "expiry-cleanup":
      return expiryCleanup();
    case "kryptos-rotation":
      return kryptosRotation();
  }
};
