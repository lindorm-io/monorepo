// ⭐ An audit or webhook block whose consumer half cannot be wired is a BOOT
// failure, not a skipped consumer.
//
// Both features are a producer on `bus` feeding a consumer that writes to `db`.
// `subscribe()` used to guard with `if (bus && db)` and quietly do nothing when
// either was missing — while the PRODUCER half kept running, because it guards
// on something else entirely: `useAuditLog` checks only `ctx.bus`, and
// `ctx.webhook()` only the iris session. So `audit: {}` with a bus and no db
// booted clean, published every record into a queue nobody consumed, and had no
// table to consume into. A deployment reads that as "audited".
//
// At boot because it is a configuration fact — known before the first request,
// and unchanged by any of them.

import { Amphora, type IAmphora } from "@lindorm/amphora";
import { type IKryptos, KryptosKit } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { ProteusSource } from "@lindorm/proteus";
import { afterEach, describe, expect, test } from "vitest";
import { Pylon } from "./Pylon.js";

const ISSUER = "http://test.lindorm.io";

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

/** A bus that swallows the consumer wiring — the guard runs before any of it. */
const createFakeBus = () =>
  ({
    addMessages: async () => undefined,
    connect: async () => undefined,
    setup: async () => undefined,
    disconnect: async () => undefined,
    workerQueue: () => ({
      create: (options: any) => ({ ...options }),
      publish: async () => undefined,
      consume: async () => undefined,
    }),
  }) as any;

const createPylon = (options: Record<string, unknown>): Pylon =>
  new Pylon({
    logger: createMockLogger(),
    amphora: createAmphora(),
    domain: ISSUER,
    environment: "test",
    name: "@lindorm/pylon",
    port: 55601,
    version: "0.0.1",
    ...options,
  } as any);

afterEach(async () => {
  for (const source of sources) {
    await source.disconnect().catch(() => undefined);
  }
  sources = [];
});

describe("Pylon boot guards for the audit pipeline", () => {
  test("should throw when an audit block has a bus but no db", async () => {
    const pylon = createPylon({ bus: createFakeBus(), audit: {} });

    await expect(pylon.setup()).rejects.toMatchObject({
      code: "audit_db_not_configured",
    });
  });

  test("should throw when an audit block has a db but no bus", async () => {
    const amphora = createAmphora();
    const pylon = createPylon({ db: createSource(amphora), audit: {} });

    await expect(pylon.setup()).rejects.toMatchObject({
      code: "audit_bus_not_configured",
    });
  });

  test("should boot when an audit block has both", async () => {
    const amphora = createAmphora();
    const pylon = createPylon({
      db: createSource(amphora),
      bus: createFakeBus(),
      audit: {},
    });

    await expect(pylon.setup()).resolves.toBeUndefined();
  });

  test("should boot untouched when there is no audit block at all", async () => {
    const pylon = createPylon({ bus: createFakeBus() });

    await expect(pylon.setup()).resolves.toBeUndefined();
  });
});

// The same shape, and the same defect: with a bus and no db, `loadSources` still
// registers `WebhookRequest`/`WebhookDispatch` on the bus, so `ctx.webhook()`
// publishes happily — into a queue whose consumer was never started, for
// subscriptions in a table that was never created.
describe("Pylon boot guards for the webhook pipeline", () => {
  test("should throw when webhooks are enabled with a bus but no db", async () => {
    const pylon = createPylon({
      bus: createFakeBus(),
      webhook: { enabled: true },
    });

    await expect(pylon.setup()).rejects.toMatchObject({
      code: "webhook_db_not_configured",
    });
  });

  test("should throw when webhooks are enabled with a db but no bus", async () => {
    const amphora = createAmphora();
    const pylon = createPylon({
      db: createSource(amphora),
      webhook: { enabled: true },
    });

    await expect(pylon.setup()).rejects.toMatchObject({
      code: "webhook_bus_not_configured",
    });
  });

  test("should boot when webhooks are enabled with both", async () => {
    const amphora = createAmphora();
    const pylon = createPylon({
      db: createSource(amphora),
      bus: createFakeBus(),
      webhook: { enabled: true },
    });

    await expect(pylon.setup()).resolves.toBeUndefined();
  });

  test("should boot untouched when webhooks are disabled", async () => {
    const pylon = createPylon({
      bus: createFakeBus(),
      webhook: { enabled: false },
    });

    await expect(pylon.setup()).resolves.toBeUndefined();
  });
});
