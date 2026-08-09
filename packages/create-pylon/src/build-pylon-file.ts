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
  const lines: Array<string> = [
    answers.features.auth
      ? `import { OpenIdDriver, Pylon } from "@lindorm/pylon";`
      : `import { Pylon } from "@lindorm/pylon";`,
  ];

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

  if (answers.bus !== "none") {
    lines.push(
      `import { sampleSubscription } from "../iris/subscribers/sample-subscriber.js";`,
    );
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

  // Pylon takes FOUR sources — `db` / `kv` / `cache` / `bus` — and no
  // per-feature overrides: where each built-in entity lives is fixed. `kv` is
  // the AUTHORITATIVE ephemeral store (sessions, presence) and `cache` the
  // EVICTABLE one (rate limits, response cache, auth caches), defaulting to
  // `kv` when unset. A scaffold picks at most one ephemeral store, so `kv` is
  // either the distinct secondary or the sole primary, and `cache` is left
  // unset — the generated comment says how to split it later.
  const kvRef = kvIsSecondary ? kvSlot!.binding : (dbSlot?.binding ?? null);

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
    // `signature` condition in code, never declared here. Pylon holds no
    // opinion on your `purpose` taxonomy — these selectors SELECT the purposes
    // the kryptos-rotation worker MINTS, so the two must stay in lockstep.
    //
    // `publish: false` is the DEFAULT for both roles — a cookie key seals what
    // only this server reopens and signs what only this server verifies — so
    // stating it changes nothing. It is written out because a scaffold should
    // show the shape a deployment reasons about, and because overriding it
    // (`publish: true`) is then an edit rather than an addition.
    lines.push(`  cookies: {`);
    lines.push(`    // Signed + sealed with the internal cookie key; verification is`);
    lines.push(`    // derived from the signature condition (code, not config).`);
    lines.push(
      `    signature: { condition: { purpose: "pylon:cookie", publish: false } },`,
    );
    lines.push(
      `    encryption: { condition: { purpose: "pylon:cookie", publish: false } },`,
    );
    lines.push(`  },`);
  }

  if (kvRef) {
    // Sessions and room presence live here and must NOT be evicted — run this
    // store with `maxmemory-policy noeviction`.
    lines.push(`  kv: ${kvRef},`);
    // Rate-limit counters, cached responses and cached driver answers are
    // disposable. Point `cache` at a SECOND store run with `allkeys-lru` to
    // keep their churn from evicting a session; unset, they share `kv`.
    // ⚠ `allkeys-lru`, not `allkeys-random`: random eviction drops the counter
    // of an actively attacking client as readily as an idle one.
    lines.push(`  // cache: evictableSource, // allkeys-lru; defaults to kv`);
  }

  if (answers.bus !== "none") {
    lines.push(`  bus: ${busSlot!.binding},`);
    lines.push(`  queue: { enabled: true },`);
    // Declared subscriptions are bound at boot, alongside pylon's own audit and
    // webhook consumers, and their message classes are registered on `bus`
    // before it sets up. Declaring one is what makes it run — a subscriber
    // wired in a helper somewhere has to be remembered and called, and one that
    // is not is silence with no error.
    lines.push(`  subscriptions: [sampleSubscription],`);
  }

  if (answers.features.webhooks) {
    lines.push(`  webhook: { enabled: true },`);
  }

  if (answers.features.audit) {
    // The block's PRESENCE is the switch — there is no `enabled` beside the
    // policy to disagree with it. Drop the block to turn auditing off.
    lines.push(`  audit: {`);
    lines.push(`    // sanitise: (body) => body,`);
    lines.push(`    // skip: (ctx) => false,`);
    lines.push(`    // entities: [],`);
    lines.push(`  },`);
  }

  if (answers.features.auth) {
    // The driver owns everything provider-specific — the authorize query,
    // token-request encoding and client authentication. Swap it for
    // Auth0Driver, or your own subclass, without touching anything below.
    //
    // ⚠ It declares NO issuer. The upstream is registered once on the amphora
    // (`idp`), which is what fetched the discovery document and the provider's
    // keys; a second issuer string here could only ever disagree with it.
    lines.push(`  auth: {`);
    lines.push(`    driver: new OpenIdDriver({`);
    lines.push(`      clientId: config.auth.clientId,`);
    lines.push(`      clientSecret: config.auth.clientSecret,`);
    lines.push(`      authorize: {`);
    lines.push(`        scope: ["openid", "profile", "email"],`);
    lines.push(`        responseType: "code",`);
    lines.push(`      },`);
    lines.push(`    }),`);
    lines.push(`    router: {`);
    lines.push(`      pathPrefix: "/auth",`);
    lines.push(`    },`);

    if (answers.features.session) {
      // The session lives under `auth` because it IS the OAuth artifact store —
      // the flow above fills it. The `Session` entity lands on the top-level
      // `kv` source; there is no per-feature source to name here.
      //
      // `name`, `httpOnly`, `encoding` and `expiry` are not settings: the name is
      // fixed, httpOnly is forced on, the value is pylon's own opaque handle, and
      // the cookie's expiry IS the session's `expiresAt`.
      lines.push(`    session: {`);
      lines.push(`      enabled: true,`);
      // The session cookie signs + seals with its OWN keys — a separate blast
      // radius from ordinary cookies. Rotated keys are only nameable when a
      // primary source exists to mint and hold them (the kryptos-rotation
      // worker). `auth.session.<role> ?? cookies.<role>` means dropping these
      // lines chains the session onto the cookie keys.
      //
      // ⚠ An encryption key is NOT optional without a primary source, because
      // no primary source means no `kv`, and a session with no store puts the
      // WHOLE session — access, id and refresh token — in the cookie itself.
      // Pylon refuses to boot such a deployment unsealed. The env-imported
      // bootstrap KEK is the one key a sourceless scaffold holds, so the session
      // seals with that until there is a rotation worker to mint its own.
      if (primaryExists) {
        lines.push(
          `      // Session's own keys — separate blast radius from other cookies.`,
        );
        lines.push(
          `      signature: { condition: { purpose: "pylon:session", publish: false } },`,
        );
        lines.push(
          `      encryption: { condition: { purpose: "pylon:session", publish: false } },`,
        );
      } else {
        lines.push(
          `      // No store, so the cookie carries the tokens themselves — sealing is`,
        );
        lines.push(
          `      // mandatory. The bootstrap KEK until a source can hold a rotated key.`,
        );
        lines.push(
          `      encryption: { condition: { purpose: "pylon:kek", publish: false } },`,
        );
      }
      lines.push(`      sameSite: "lax",`);
      lines.push(
        `      secure: false, // TODO: flip to true in production (behind HTTPS)`,
      );
      lines.push(`    },`);
    }

    lines.push(`  },`);
  }

  if (answers.features.rateLimit) {
    // Counters land on the evictable `cache` source, which falls back to `kv`.
    //
    // ⚠ This block is POLICY, never a switch — MOUNTING is the switch, and the
    // generated `src/routes/_middleware.ts` mounts a bare `useRateLimit()`.
    // These are therefore the only numbers that mount has: drop the block and it
    // is bounded by nothing, which throws `rate_limit_not_bounded` on every
    // request. Block and mount ship together or not at all.
    lines.push(`  rateLimit: {`);
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
