import type { Answers } from "./types.js";

const buildImports = (answers: Answers): Array<string> => {
  const lines: Array<string> = [`import { Pylon } from "@lindorm/pylon";`];

  if (answers.features.http || answers.features.socket || answers.workers.length > 0) {
    lines.push(`import { join } from "path";`);
  }

  lines.push(
    `import { logger } from "../logger/index.js";`,
    `import { amphora } from "./amphora.js";`,
    `import { config } from "./config.js";`,
  );

  if (answers.proteusDriver !== "none") {
    lines.push(`import { source as proteusSource } from "../proteus/source.js";`);
  }

  if (answers.irisDriver !== "none") {
    lines.push(`import { source as irisSource } from "../iris/source.js";`);
  }

  return lines;
};

const buildWorkersPath = (answers: Answers): string | null => {
  if (answers.workers.length === 0) return null;

  return `  workers: join(import.meta.dirname, "..", "workers"),`;
};

const buildOptions = (answers: Answers): string => {
  const lines: Array<string> = [`  logger,`, `  amphora,`, `  port: config.server.port,`];

  if (answers.features.http) {
    lines.push(`  routes: join(import.meta.dirname, "..", "routes"),`);
  }

  if (answers.features.socket) {
    lines.push(`  socket: {`);
    lines.push(`    enabled: true,`);
    lines.push(`    listeners: join(import.meta.dirname, "..", "listeners"),`);
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
    lines.push(`    actor: (ctx) => ctx.state.session?.subject ?? "anonymous",`);
    lines.push(`    // sanitise: (body) => body,`);
    lines.push(`    // skip: (ctx) => false,`);
    lines.push(`    // entities: [],`);
    lines.push(`  },`);
  }

  if (answers.features.session) {
    lines.push(`  session: {`);
    lines.push(`    enabled: true,`);
    if (answers.proteusDriver !== "none") {
      lines.push(`    proteus: proteusSource,`);
    }
    lines.push(`    name: "sid",`);
    lines.push(`    encrypted: true,`);
    lines.push(`    httpOnly: true,`);
    lines.push(`    sameSite: "lax",`);
    lines.push(`    secure: false, // TODO: flip to true in production (behind HTTPS)`);
    lines.push(`    expiry: "7d",`);
    lines.push(`  },`);
  }

  if (answers.features.auth) {
    lines.push(`  auth: {`);
    lines.push(`    clientId: config.authClientId,`);
    lines.push(`    clientSecret: config.authClientSecret,`);
    lines.push(`    issuer: config.authIssuer,`);
    lines.push(`    router: {`);
    lines.push(`      pathPrefix: "/auth",`);
    lines.push(`      authorize: {`);
    lines.push(`        scope: ["openid", "profile", "email"],`);
    lines.push(`        responseType: "code",`);
    lines.push(`      },`);
    lines.push(`    },`);
    lines.push(`  },`);
  }

  if (answers.features.rateLimit) {
    lines.push(`  rateLimit: {`);
    lines.push(`    enabled: true,`);
    if (answers.proteusDriver !== "none") {
      lines.push(`    proteus: proteusSource,`);
    }
    lines.push(`    strategy: "fixed",`);
    lines.push(`    window: "1m",`);
    lines.push(`    max: 60,`);
    lines.push(`    // TODO: tune strategy/window/max for your traffic`);
    lines.push(`  },`);
  }

  const workers = buildWorkersPath(answers);
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
