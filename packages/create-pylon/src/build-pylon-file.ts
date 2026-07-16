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

    // Flat cookie key selectors. Naming a `signature` / `encryption` selector
    // turns that role ON — a plain `set()` is signed and sealed, the matching
    // `get()` verifies and opens it. There is no `signed`/`encrypted` boolean
    // and no `verification` selector: verification is derived from the
    // `signature` predicate in code, never declared here. Pylon holds no
    // opinion on your `purpose` taxonomy — these selectors SELECT the purposes
    // the kryptos-rotation worker MINTS, so the two must stay in lockstep.
    //
    // ⚠ `publish: false` is load-bearing: amphora's default query is the
    // PUBLISHED set, so an internal cookie key is unreachable without it and
    // the JWKS token key would be selected instead.
    lines.push(`  cookies: {`);
    lines.push(`    // Signed + sealed with the internal cookie key; verification is`);
    lines.push(`    // derived from the signature predicate (code, not config).`);
    lines.push(
      `    signature: { predicate: { purpose: "pylon:cookie", publish: false } },`,
    );
    lines.push(
      `    encryption: { predicate: { purpose: "pylon:cookie", publish: false } },`,
    );
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
    // The session cookie signs + seals with its OWN keys — a separate blast
    // radius from ordinary cookies. Only nameable when a primary source exists
    // to mint and hold them (the kryptos-rotation worker); without one the
    // session cookie falls back to unsigned. `session.<role> ?? cookies.<role>`
    // means dropping these two lines chains the session onto the cookie keys.
    if (primaryExists) {
      lines.push(`    // Session's own keys — separate blast radius from other cookies.`);
      lines.push(
        `    signature: { predicate: { purpose: "pylon:session", publish: false } },`,
      );
      lines.push(
        `    encryption: { predicate: { purpose: "pylon:session", publish: false } },`,
      );
    }
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
