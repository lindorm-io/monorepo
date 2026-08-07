// Which SOURCE each built-in entity lands in. Pylon takes four sources —
// `db` / `kv` / `cache` / `bus` — and the placement is fixed: there are no
// per-feature overrides to disagree with it.
//
// The split criterion is "is eviction under memory pressure acceptable?", the
// question a redis `maxmemory-policy` answers. `cache` is the evictable half
// (`allkeys-lru`), `kv` the authoritative one (`noeviction`) — so a rate-limit
// bucket can never push a `Session` out.
//
// Driven against REAL sqlite sources: which table a source actually
// synchronised is the only honest answer, and a mock cannot give it.

import { Amphora, type IAmphora } from "@lindorm/amphora";
import { type IKryptos, KryptosKit } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { ProteusSource } from "@lindorm/proteus";
import { afterEach, describe, expect, test } from "vitest";
import { OpenIdResourceDriver } from "../drivers/auth/OpenIdResourceDriver.js";
import { WebhookSubscription } from "../entities/WebhookSubscription.js";
import { Pylon } from "./Pylon.js";

const ISSUER = "http://test.lindorm.io";

/** Everything that must survive eviction. */
const AUTHORITATIVE = ["Session", "Presence"];

/** Everything that is disposable — losing an entry costs work, never state. */
const EVICTABLE = [
  "CachedResponse",
  "CachedIntrospection",
  "CachedUserinfo",
  "RateLimitFixed",
  "RateLimitSliding",
  "RateLimitBucket",
];

/** Durable and relational. */
const DURABLE = ["Kryptos", "WebhookSubscription", "RequestAuditLog", "DataAuditLog"];

let sources: Array<ProteusSource> = [];

const createSource = (amphora: IAmphora): ProteusSource => {
  const source = new ProteusSource({
    driver: "sqlite",
    filename: ":memory:",
    entities: [] as never,
    logger: createMockLogger(),
    synchronize: true,
    amphora,
  });
  sources.push(source);
  return source;
};

const createAmphora = (): IAmphora => {
  const amphora = new Amphora({
    internal: { issuer: ISSUER },
    logger: createMockLogger(),
  });
  const kek: IKryptos = KryptosKit.generate.enc.oct({
    algorithm: "A128KW",
    publish: false,
    purpose: "pylon:kek",
  });
  amphora.add([kek]);
  return amphora;
};

/** A bus that records registered messages and swallows the consumer wiring. */
const createFakeBus = () => {
  const messages: Array<string> = [];
  return {
    addMessages: (list: Array<any>) => messages.push(...list.map((m) => m.name)),
    connect: async () => undefined,
    setup: async () => undefined,
    disconnect: async () => undefined,
    workerQueue: () => ({
      create: (options: any) => ({ ...options }),
      publish: async () => undefined,
      consume: async () => undefined,
    }),
    messages,
  } as any;
};

/** Every feature that owns an entity, switched on at once. */
const createPylon = (
  amphora: IAmphora,
  sourcesInUse: { db: ProteusSource; kv: ProteusSource; cache?: ProteusSource },
  bus: any,
): Pylon =>
  new Pylon({
    logger: createMockLogger(),
    amphora,
    domain: ISSUER,
    environment: "test",
    name: "@lindorm/pylon",
    port: 55599,
    version: "0.0.1",

    db: sourcesInUse.db as any,
    kv: sourcesInUse.kv as any,
    cache: sourcesInUse.cache as any,
    bus,

    audit: { enabled: true, entities: [WebhookSubscription] },
    auth: {
      driver: new OpenIdResourceDriver({
        clientId: "client-id",
        clientSecret: "client-secret",
      }),
      cache: { enabled: true },
      session: { enabled: true },
    },
    kryptos: { enabled: true },
    queue: { enabled: true },
    rateLimit: { enabled: true, window: "1 minute", max: 10 },
    responseCache: { enabled: true },
    rooms: { presence: true },
    webhook: { enabled: true },
  });

/** The tables proteus synchronised onto this source. */
const tableNames = async (source: ProteusSource): Promise<Array<string>> => {
  await source.connect();
  await source.setup();

  const client = await source.client<any>();

  return client
    .all("SELECT name FROM sqlite_master WHERE type = 'table'")
    .map((r: any) => r.name as string);
};

describe("Pylon source placement", () => {
  let pylon: Pylon;

  afterEach(async () => {
    await pylon?.teardown();
    await Promise.all(sources.map((s) => s.disconnect()));
    sources = [];
  });

  describe("cache split off kv", () => {
    test("should place every entity on the source its role dictates", async () => {
      const amphora = createAmphora();
      const db = createSource(amphora);
      const kv = createSource(amphora);
      const cache = createSource(amphora);
      const bus = createFakeBus();

      pylon = createPylon(amphora, { db, kv, cache }, bus);

      await pylon.setup();

      const dbTables = await tableNames(db);
      const kvTables = await tableNames(kv);
      const cacheTables = await tableNames(cache);

      expect(dbTables).toEqual(expect.arrayContaining(DURABLE));
      expect(kvTables).toEqual(expect.arrayContaining(AUTHORITATIVE));
      expect(cacheTables).toEqual(expect.arrayContaining(EVICTABLE));

      // And nothing bleeds across a role boundary.
      for (const table of [...AUTHORITATIVE, ...EVICTABLE]) {
        expect(dbTables).not.toContain(table);
      }
      for (const table of [...DURABLE, ...EVICTABLE]) {
        expect(kvTables).not.toContain(table);
      }
      for (const table of [...DURABLE, ...AUTHORITATIVE]) {
        expect(cacheTables).not.toContain(table);
      }
    });

    // The headline conflict the role exists to end: rate-limit churn shares an
    // instance with sessions, so a traffic spike evicts logins.
    test("should keep Session and the rate-limit buckets in different sources", async () => {
      const amphora = createAmphora();
      const db = createSource(amphora);
      const kv = createSource(amphora);
      const cache = createSource(amphora);

      pylon = createPylon(amphora, { db, kv, cache }, createFakeBus());

      await pylon.setup();

      const kvTables = await tableNames(kv);
      const cacheTables = await tableNames(cache);

      expect(kvTables).toContain("Session");
      expect(kvTables).not.toContain("RateLimitFixed");

      expect(cacheTables).toContain("RateLimitFixed");
      expect(cacheTables).not.toContain("Session");
    });

    test("should register the Job message on the bus", async () => {
      const amphora = createAmphora();
      const bus = createFakeBus();

      pylon = createPylon(
        amphora,
        { db: createSource(amphora), kv: createSource(amphora) },
        bus,
      );

      await pylon.setup();

      expect(bus.messages).toEqual(
        expect.arrayContaining([
          "Job",
          "WebhookRequest",
          "WebhookDispatch",
          "RequestAudit",
          "DataAuditChange",
        ]),
      );
    });
  });

  // `cache ?? kv`: a single-instance deployment configures one ephemeral store
  // and nothing changes for it.
  describe("cache unset", () => {
    test("should place every evictable entity on kv alongside the authoritative ones", async () => {
      const amphora = createAmphora();
      const db = createSource(amphora);
      const kv = createSource(amphora);

      pylon = createPylon(amphora, { db, kv }, createFakeBus());

      await pylon.setup();

      const dbTables = await tableNames(db);
      const kvTables = await tableNames(kv);

      expect(kvTables).toEqual(expect.arrayContaining([...AUTHORITATIVE, ...EVICTABLE]));
      expect(dbTables).toEqual(expect.arrayContaining(DURABLE));

      for (const table of [...AUTHORITATIVE, ...EVICTABLE]) {
        expect(dbTables).not.toContain(table);
      }
    });
  });

  // No ephemeral source at all: every ephemeral feature simply registers
  // nothing, and setup still succeeds.
  describe("no ephemeral source", () => {
    test("should set up with a db alone", async () => {
      const amphora = createAmphora();
      const db = createSource(amphora);
      const bus = createFakeBus();

      pylon = new Pylon({
        logger: createMockLogger(),
        amphora,
        domain: ISSUER,
        environment: "test",
        name: "@lindorm/pylon",
        port: 55599,
        version: "0.0.1",
        db: db as any,
        bus,
        auth: {
          driver: new OpenIdResourceDriver({
            clientId: "client-id",
            clientSecret: "client-secret",
          }),
          session: { enabled: true },
        },
        kryptos: { enabled: true },
        rateLimit: { enabled: true, window: "1 minute", max: 10 },
        responseCache: { enabled: true },
        rooms: { presence: true },
      });

      await expect(pylon.setup()).resolves.toBeUndefined();

      const dbTables = await tableNames(db);

      for (const table of [...AUTHORITATIVE, ...EVICTABLE]) {
        expect(dbTables).not.toContain(table);
      }
      expect(dbTables).toContain("Kryptos");
    });
  });
});
