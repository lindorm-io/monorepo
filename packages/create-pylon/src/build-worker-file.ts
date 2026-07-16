import type { WorkerKey } from "./types.js";

const SOURCE_IMPORT = "../proteus/db/source.js";

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

// Pylon has NO default key set — it does not know your `purpose` taxonomy and
// will not invent one. So the keys are scaffolded here, explicitly, as source you
// can read and edit. The pylon `cookies` / `session` key selectors name the same
// `pylon:*` purposes, so every role resolves the key it is meant to use.
const kryptosRotation = (dbDriver: string): string =>
  [
    `import { createKryptosRotationWorker } from "@lindorm/pylon";`,
    `import { amphora } from "../pylon/amphora.js";`,
    `import { logger } from "../logger/index.js";`,
    `import { ${dbDriver} } from "${SOURCE_IMPORT}";`,
    ``,
    `// The keys this app mints and rotates. \`publish\` is stated on EVERY key: it`,
    `// decides which keys reach the JWKS and which never leave the server, and it`,
    `// defaults to false — a key you want published MUST say so, or the JWKS is`,
    `// empty and no relying party can verify anything.`,
    `//`,
    `// Cookie + session keys are internal and long-lived (1y) — they never leave`,
    `// the server, and rotating them churns live sessions. Token keys are published`,
    `// and rotate faster (6mo) — a smaller blast radius if leaked, and relying`,
    `// parties re-fetch the JWKS anyway.`,
    `//`,
    `// The \`pylon:cookie\` / \`pylon:session\` purposes below are the ones`,
    `// \`src/pylon/pylon.ts\` selects on (its flat \`cookies\` / \`session\` key`,
    `// selectors); \`pylon:token\` feeds the published JWKS. Rename one here and`,
    `// you must rename it there too.`,
    ``,
    // Pass the amphora so freshly-minted keys land in the vault immediately
    // (JWKS is populated on first boot, not after the next entity-sync tick).
    `export default createKryptosRotationWorker({`,
    `  amphora,`,
    `  logger,`,
    `  db: ${dbDriver},`,
    `  keys: [`,
    `    { algorithm: "dir", publish: false, purpose: "pylon:cookie", expiry: "1y" },`,
    `    { algorithm: "HS256", publish: false, purpose: "pylon:cookie", expiry: "1y" },`,
    `    {`,
    `      algorithm: "EdDSA",`,
    `      curve: "Ed448",`,
    `      publish: false,`,
    `      purpose: "pylon:session",`,
    `      expiry: "1y",`,
    `    },`,
    `    {`,
    `      algorithm: "ECDH-ES",`,
    `      curve: "X448",`,
    `      publish: false,`,
    `      purpose: "pylon:session",`,
    `      expiry: "1y",`,
    `    },`,
    `    {`,
    `      algorithm: "EdDSA",`,
    `      curve: "Ed25519",`,
    `      publish: true,`,
    `      purpose: "pylon:token",`,
    `      expiry: "6mo",`,
    `    },`,
    `    {`,
    `      // ECDH-ES+A256KW, not +A256GCMKW: the GCMKW variants are NOT registered`,
    `      // JWE algorithms — RFC 7518 §4.6 defines ECDH-ES and the three +A*KW`,
    `      // forms only — so \`jose\`, and every RP built on it, rejects them on the`,
    `      // \`alg\` value alone. A published key nobody can import is not a key.`,
    `      algorithm: "ECDH-ES+A256KW",`,
    `      curve: "X448",`,
    `      publish: true,`,
    `      purpose: "pylon:token",`,
    `      expiry: "6mo",`,
    `    },`,
    `  ],`,
    `});`,
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
