import type { Answers, ProteusDriver } from "./types.js";
import { PROTEUS_PRIMARY_PRIORITY } from "./types.js";

const RATE_LIMIT_PRIORITY: ReadonlyArray<ProteusDriver> = ["redis", "memory"];
const SESSION_PRIORITY: ReadonlyArray<ProteusDriver> = ["redis", "memory"];

const pickPrimary = (drivers: ReadonlyArray<ProteusDriver>): ProteusDriver | null => {
  for (const d of PROTEUS_PRIMARY_PRIORITY) {
    if (drivers.includes(d)) return d;
  }
  return null;
};

const pickRateLimitDriver = (
  drivers: ReadonlyArray<ProteusDriver>,
): ProteusDriver | null => {
  for (const d of RATE_LIMIT_PRIORITY) {
    if (drivers.includes(d)) return d;
  }
  return null;
};

// Session source preference: a fast key-value store (redis > memory) first,
// then fall back to the primary if the user didn't pick one.
const pickSessionDriver = (
  drivers: ReadonlyArray<ProteusDriver>,
): ProteusDriver | null => {
  for (const d of SESSION_PRIORITY) {
    if (drivers.includes(d)) return d;
  }
  return pickPrimary(drivers);
};

const sourceImportPath = (driver: ProteusDriver, nested: boolean): string =>
  nested ? `../proteus/${driver}/source.js` : `../proteus/source.js`;

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

  const drivers = answers.proteusDrivers;
  const nested = drivers.length > 1;
  const primary = pickPrimary(drivers);
  const rateLimitDriver = answers.features.rateLimit
    ? pickRateLimitDriver(drivers)
    : null;

  if (primary) {
    lines.push(
      `import { source as proteusSource } from "${sourceImportPath(primary, nested)}";`,
    );
  }

  if (rateLimitDriver && rateLimitDriver !== primary) {
    lines.push(
      `import { source as rateLimitSource } from "${sourceImportPath(rateLimitDriver, nested)}";`,
    );
  }

  const sessionDriver = answers.features.session ? pickSessionDriver(drivers) : null;

  if (sessionDriver && sessionDriver !== primary && sessionDriver !== rateLimitDriver) {
    lines.push(
      `import { source as sessionSource } from "${sourceImportPath(sessionDriver, nested)}";`,
    );
  }

  if (nested && primary) {
    lines.push(
      `import { attachSourcesMiddleware } from "../middleware/attach-sources.js";`,
    );
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
  const lines: Array<string> = [
    `  logger,`,
    `  amphora,`,
    `  name: config.npm.package.name,`,
    `  version: config.npm.package.version,`,
    `  environment: config.node.env,`,
    `  port: config.server.port,`,
  ];
  const drivers = answers.proteusDrivers;
  const nested = drivers.length > 1;
  const primary = pickPrimary(drivers);
  const rateLimitDriver = answers.features.rateLimit
    ? pickRateLimitDriver(drivers)
    : null;
  const rateLimitSourceRef =
    rateLimitDriver && rateLimitDriver !== primary ? "rateLimitSource" : "proteusSource";

  const sessionDriver = answers.features.session ? pickSessionDriver(drivers) : null;
  // Prefer reusing the rateLimit import alias when both features settle on
  // the same driver (typical when Redis is in the selection) — avoids
  // two imports of the same module under different aliases.
  const sessionSourceRef = !sessionDriver
    ? "proteusSource"
    : sessionDriver === primary
      ? "proteusSource"
      : sessionDriver === rateLimitDriver
        ? "rateLimitSource"
        : "sessionSource";

  if (answers.features.http) {
    lines.push(`  routes: join(import.meta.dirname, "..", "routes"),`);
  }

  if (nested && primary) {
    lines.push(`  httpMiddleware: [attachSourcesMiddleware],`);
  }

  if (answers.features.socket) {
    lines.push(`  socket: {`);
    lines.push(`    enabled: true,`);
    lines.push(`    listeners: join(import.meta.dirname, "..", "listeners"),`);
    if (nested && primary) {
      lines.push(`    middleware: [attachSourcesMiddleware],`);
    }
    lines.push(`  },`);
    lines.push(`  rooms: { presence: true },`);
  }

  if (primary) {
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
    if (sessionDriver) {
      lines.push(`    proteus: ${sessionSourceRef},`);
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
    lines.push(`    clientId: config.auth.clientId,`);
    lines.push(`    clientSecret: config.auth.clientSecret,`);
    lines.push(`    issuer: config.auth.issuer,`);
    lines.push(`    router: {`);
    lines.push(`      pathPrefix: "/auth",`);
    lines.push(`      authorize: {`);
    lines.push(`        scope: ["openid", "profile", "email"],`);
    lines.push(`        responseType: "code",`);
    lines.push(`      },`);
    lines.push(`    },`);
    lines.push(`  },`);
  }

  if (answers.features.rateLimit && rateLimitDriver) {
    lines.push(`  rateLimit: {`);
    lines.push(`    enabled: true,`);
    lines.push(`    proteus: ${rateLimitSourceRef},`);
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
  if (primary) {
    lines.push(`    await proteusSource.connect();`);
  }
  if (rateLimitDriver && rateLimitDriver !== primary) {
    lines.push(`    await rateLimitSource.connect();`);
  }
  if (sessionDriver && sessionDriver !== primary && sessionDriver !== rateLimitDriver) {
    lines.push(`    await sessionSource.connect();`);
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
