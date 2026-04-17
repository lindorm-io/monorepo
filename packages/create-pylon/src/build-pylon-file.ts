import type { Answers, WorkerKey } from "./types";

const WORKER_IMPORTS: Record<WorkerKey, { local: string; path: string }> = {
  "amphora-refresh": {
    local: "amphoraRefreshWorker",
    path: "../workers/amphora-refresh",
  },
  "amphora-entity-sync": {
    local: "amphoraEntitySyncWorker",
    path: "../workers/amphora-entity-sync",
  },
  "expiry-cleanup": {
    local: "expiryCleanupWorker",
    path: "../workers/expiry-cleanup",
  },
  "kryptos-rotation": {
    local: "kryptosRotationWorker",
    path: "../workers/kryptos-rotation",
  },
};

const buildImports = (answers: Answers): Array<string> => {
  const lines: Array<string> = [
    `import { Pylon } from "@lindorm/pylon";`,
    `import { logger } from "../logger";`,
    `import { amphora } from "./amphora";`,
    `import { config } from "./config";`,
  ];

  if (answers.proteusDriver !== "none") {
    lines.push(`import { source as proteusSource } from "../proteus/source";`);
  }

  if (answers.irisDriver !== "none") {
    lines.push(`import { source as irisSource } from "../iris/source";`);
  }

  for (const key of answers.workers) {
    const { local, path } = WORKER_IMPORTS[key];
    lines.push(`import ${local} from "${path}";`);
  }

  return lines;
};

const buildWorkersArray = (answers: Answers): string | null => {
  if (answers.workers.length === 0) return null;

  const entries = answers.workers.map((k) => `    ${WORKER_IMPORTS[k].local},`);

  return [`  workers: [`, ...entries, `  ],`].join("\n");
};

const buildOptions = (answers: Answers): string => {
  const lines: Array<string> = [`  logger,`, `  amphora,`, `  port: config.server.port,`];

  if (answers.features.http) {
    lines.push(`  routes: "./src/routes",`);
  }

  if (answers.features.socket) {
    lines.push(`  socket: {`);
    lines.push(`    enabled: true,`);
    lines.push(`    listeners: "./src/listeners",`);
    lines.push(`  },`);
    lines.push(`  rooms: { presence: true },`);
  }

  if (answers.proteusDriver !== "none") {
    lines.push(`  proteus: proteusSource,`);
    lines.push(`  kryptos: { enabled: true },`);
  }

  if (answers.irisDriver !== "none") {
    lines.push(`  iris: irisSource,`);
    lines.push(`  queue: { enabled: true },`);
  }

  if (answers.features.webhooks) {
    lines.push(`  webhook: { enabled: true },`);
  }

  if (answers.features.audit) {
    lines.push(`  audit: {`);
    lines.push(`    enabled: true,`);
    lines.push(`    actor: (ctx) => (ctx.state as any).subject ?? "anonymous",`);
    lines.push(`    // sanitise: (body) => body,`);
    lines.push(`    // skip: (ctx) => false,`);
    lines.push(`    // entities: [],`);
    lines.push(`  },`);
  }

  const workers = buildWorkersArray(answers);
  if (workers) {
    lines.push(workers);
  }

  lines.push(`  setup: async () => {`);
  if (answers.proteusDriver !== "none") {
    lines.push(`    await proteusSource.connect();`);
  }
  if (answers.irisDriver !== "none") {
    lines.push(`    await irisSource.connect();`);
  }
  lines.push(`  },`);

  lines.push(`  teardown: async () => {`);
  lines.push(`    // pylon handles proteus/iris disconnect automatically`);
  lines.push(`  },`);

  return lines.join("\n");
};

export const buildPylonFile = (answers: Answers): string => {
  const imports = buildImports(answers);
  const options = buildOptions(answers);

  const lines: Array<string> = [
    ...imports,
    ``,
    `export const pylon = new Pylon({`,
    options,
    `});`,
    ``,
  ];

  return lines.join("\n");
};
