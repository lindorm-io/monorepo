import type { Answers } from "./types.js";

type SourceRole = "db" | "kv" | "bus";

type SourceSlot = {
  role: SourceRole;
  driver: string;
  path: string;
  binding: string;
};

const ROLE_SUFFIX: Record<SourceRole, string> = {
  db: "Db",
  kv: "Kv",
  bus: "Bus",
};

// One import binding per wired source. Each generated source file exports its
// value under its driver name (`export const postgres = …`), so the import name
// IS the driver name — unless two roles share a driver (the real case: kv=redis
// alongside bus=redis, or db=none→primary=redis alongside bus=redis), in which
// case we alias to `${driver}${Role}` to keep the imports unambiguous.
const computeSlots = (answers: Answers): Array<SourceSlot> => {
  const primaryExists = answers.db !== "none" || answers.kv !== "none";
  const kvIsSecondary = answers.db !== "none" && answers.kv !== "none";
  const primaryDriver = answers.db !== "none" ? answers.db : answers.kv;
  const busExists = answers.bus !== "none";

  const slots: Array<SourceSlot> = [];

  if (primaryExists) {
    slots.push({
      role: "db",
      driver: primaryDriver,
      path: "../proteus/db/source.js",
      binding: primaryDriver,
    });
  }

  if (kvIsSecondary) {
    slots.push({
      role: "kv",
      driver: answers.kv,
      path: "../proteus/kv/source.js",
      binding: answers.kv,
    });
  }

  if (busExists) {
    slots.push({
      role: "bus",
      driver: answers.bus,
      path: "../iris/source.js",
      binding: answers.bus,
    });
  }

  const counts = slots.reduce<Record<string, number>>((acc, slot) => {
    acc[slot.driver] = (acc[slot.driver] ?? 0) + 1;
    return acc;
  }, {});

  for (const slot of slots) {
    if (counts[slot.driver] > 1) {
      slot.binding = `${slot.driver}${ROLE_SUFFIX[slot.role]}`;
    }
  }

  return slots;
};

const slotByRole = (slots: Array<SourceSlot>, role: SourceRole): SourceSlot | null =>
  slots.find((slot) => slot.role === role) ?? null;

const importStatement = (slot: SourceSlot): string => {
  const named =
    slot.binding === slot.driver ? slot.driver : `${slot.driver} as ${slot.binding}`;
  return `import { ${named} } from "${slot.path}";`;
};

const buildImports = (answers: Answers, slots: Array<SourceSlot>): Array<string> => {
  const lines: Array<string> = [`import { Pylon } from "@lindorm/pylon";`];

  if (answers.features.http || answers.features.socket || answers.workers.length > 0) {
    lines.push(`import { join } from "path";`);
  }

  lines.push(
    `import { logger } from "../logger/index.js";`,
    `import { amphora } from "./amphora.js";`,
    `import { config } from "./config.js";`,
  );

  for (const slot of slots) {
    lines.push(importStatement(slot));
  }

  return lines;
};

const buildWorkersPath = (answers: Answers): string | null => {
  if (answers.workers.length === 0) return null;

  return `  workers: join(import.meta.dirname, "..", "workers"),`;
};

const buildOptions = (answers: Answers, slots: Array<SourceSlot>): string => {
  const lines: Array<string> = [
    `  logger,`,
    `  amphora,`,
    `  name: config.npm.package.name,`,
    `  version: config.npm.package.version,`,
    `  environment: config.nodeEnv,`,
    `  port: config.server.port,`,
  ];

  const dbSlot = slotByRole(slots, "db");
  const kvSlot = slotByRole(slots, "kv");
  const busSlot = slotByRole(slots, "bus");

  const primaryExists = answers.db !== "none" || answers.kv !== "none";
  const kvIsSecondary = answers.db !== "none" && answers.kv !== "none";

  // When a kv store is picked, the kv source is either the distinct secondary
  // (kvSlot) or, when kv is the sole primary, the db-role primary (dbSlot).
  const kvRef = kvIsSecondary ? kvSlot!.binding : (dbSlot?.binding ?? null);

  // session falls back to the db primary as its keyValue store when no kv
  // store was picked (preserves old behaviour).
  const sessionRef =
    answers.kv !== "none" ? kvRef : answers.db !== "none" ? dbSlot!.binding : null;

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

  if (primaryExists) {
    lines.push(`  db: ${dbSlot!.binding},`);
    lines.push(`  kryptos: { enabled: true },`);

    // Which vault key does what. Pylon holds no opinion — it does not know your
    // `purpose` taxonomy — so every key role it resolves is named here, matching
    // the purposes the kryptos-rotation worker mints.
    //
    // A pylon session IS a cookie, so `session` is a per-role OVERRIDE of
    // `cookie`: `session.<role> ?? cookie.<role>`. Both are named here because
    // the worker mints both key sets; delete the `session` block and every role
    // chains to the cookie keys instead.
    //
    // ⚠ `publish: false` is load-bearing: amphora's default query is the
    // PUBLISHED set, so an internal cookie/session key is unreachable without it
    // and the JWKS token key would be selected instead.
    lines.push(`  keys: {`);
    lines.push(
      `    // \`verification\` — the check on the key a cookie's kid names — is`,
    );
    lines.push(`    // omitted: it defaults to the SIGNING predicate of its own scope,`);
    lines.push(
      `    // which is the only read policy that cannot reject a cookie this app`,
    );
    lines.push(`    // just issued. Name it only to make the read policy deliberately`);
    lines.push(`    // BROADER (e.g. \`{ predicate: { publish: false } }\` to keep live`);
    lines.push(`    // session cookies valid while migrating to a new signing key).`);
    lines.push(`    cookie: {`);
    lines.push(`      signature: { predicate: { purpose: "cookie", publish: false } },`);
    lines.push(`      encryption: { predicate: { purpose: "cookie", publish: false } },`);
    lines.push(`    },`);
    lines.push(`    // The session cookie gets its own keys — a separate blast radius,`);
    lines.push(`    // and an asymmetric signature.`);
    lines.push(`    session: {`);
    lines.push(`      signature: { predicate: { purpose: "session", publish: false } },`);
    lines.push(
      `      encryption: { predicate: { purpose: "session", publish: false } },`,
    );
    lines.push(`    },`);
    lines.push(`  },`);
  }

  if (kvIsSecondary) {
    lines.push(`  kv: ${kvSlot!.binding},`);
  }

  if (answers.bus !== "none") {
    lines.push(`  bus: ${busSlot!.binding},`);
    lines.push(`  queue: { enabled: true },`);
  }

  if (answers.features.webhooks) {
    lines.push(`  webhook: { enabled: true },`);
  }

  if (answers.features.audit) {
    lines.push(`  audit: {`);
    lines.push(`    enabled: true,`);
    lines.push(`    // sanitise: (body) => body,`);
    lines.push(`    // skip: (ctx) => false,`);
    lines.push(`    // entities: [],`);
    lines.push(`  },`);
  }

  if (answers.features.session) {
    lines.push(`  session: {`);
    lines.push(`    enabled: true,`);
    if (sessionRef) {
      lines.push(`    kv: ${sessionRef},`);
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

  if (answers.features.rateLimit) {
    lines.push(`  rateLimit: {`);
    lines.push(`    enabled: true,`);
    lines.push(`    kv: ${kvRef},`);
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
  for (const slot of slots) {
    lines.push(`    await ${slot.binding}.connect();`);
  }
  lines.push(`  },`);

  lines.push(`  teardown: async () => {`);
  lines.push(`    // pylon handles proteus/iris disconnect automatically`);
  lines.push(`  },`);

  return lines.join("\n");
};

export const buildPylonFile = (answers: Answers): string => {
  const slots = computeSlots(answers);
  const imports = buildImports(answers, slots);
  const options = buildOptions(answers, slots);

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
