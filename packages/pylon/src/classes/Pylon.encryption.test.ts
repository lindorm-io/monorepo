// At-rest encryption wired end to end: pylon stages the KEK selector from its
// settings onto the bare `@Encrypted()` markers on `Kryptos.privateKey` and
// `WebhookSubscription.clientSecret` before the source sets up, against a REAL
// sqlite database and a REAL Amphora. A mocked vault cannot prove which key
// actually sealed the column, which is the whole point.

import { parseAes } from "@lindorm/aes";
import { Amphora, type IAmphora } from "@lindorm/amphora";
import { type IKryptos, KryptosKit } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { ProteusError, ProteusSource } from "@lindorm/proteus";
import { afterEach, beforeEach, describe, expect, type Mock, test, vi } from "vitest";
import {
  setupWebhookDispatchConsumer,
  WEBHOOK_DISPATCH_QUEUE,
} from "../internal/consumers/setup-webhook-dispatch-consumer.js";
import {
  setupWebhookRequestConsumer,
  WEBHOOK_REQUEST_QUEUE,
} from "../internal/consumers/setup-webhook-request-consumer.js";
import { createDispatchWebhook } from "../internal/utils/dispatch-webhook.js";
import { Kryptos } from "../entities/Kryptos.js";
import { WebhookSubscription } from "../entities/WebhookSubscription.js";
import { WebhookAuth } from "../enums/index.js";
import { Pylon } from "./Pylon.js";

// The dispatch consumer's fan-out is mocked so the bus test can inspect the
// subscription handed to it (with a decrypted secret) without a real HTTP call.
vi.mock("../internal/utils/dispatch-webhook.js");

const ISSUER = "http://test.lindorm.io";

/** The bootstrap key-encryption-key — pylon's default `pylon:kek` selector,
 *  shared by stored private keys and webhook client secrets alike. */
const kekKey = (): IKryptos =>
  KryptosKit.generate.enc.oct({
    algorithm: "A128KW",
    issuer: ISSUER,
    publish: false,
    purpose: "pylon:kek",
  });

/** A minimal in-memory bus that records published messages and captures the
 *  consume callbacks — enough to drive request → dispatch by hand. */
const createFakeBus = () => {
  const published: Array<any> = [];
  const handlers = new Map<string, (message: any) => Promise<void>>();
  const queue = {
    create: (options: any) => ({ ...options }),
    publish: async (message: any) => {
      published.push(message);
    },
    consume: async (name: string, cb: (message: any) => Promise<void>) => {
      handlers.set(name, cb);
    },
  };
  return { published, handlers, workerQueue: () => queue } as any;
};

let sources: Array<ProteusSource> = [];

const track = (source: ProteusSource): ProteusSource => {
  sources.push(source);
  return source;
};

const createSource = (amphora: IAmphora): ProteusSource =>
  track(
    new ProteusSource({
      driver: "sqlite",
      filename: ":memory:",
      entities: [] as never,
      logger: createMockLogger(),
      synchronize: true,
      amphora,
    }),
  );

const createPylon = (amphora: IAmphora, db: ProteusSource): Pylon =>
  new Pylon({
    logger: createMockLogger(),
    amphora,
    domain: ISSUER,
    environment: "test",
    name: "@lindorm/pylon",
    port: 55598,
    version: "0.0.1",
    db: db as any,
    kryptos: { enabled: true },
    webhook: { enabled: true },
  });

/** Every string column of the stored row, found by scanning the raw tables for
 *  the one holding this id — so the assertion never hard-codes the naming
 *  strategy's table/column names. */
const rawStringColumns = async (
  source: ProteusSource,
  id: string,
): Promise<Array<string>> => {
  const client = await source.client<any>();
  const tables: Array<string> = client
    .all("SELECT name FROM sqlite_master WHERE type = 'table'")
    .map((r: any) => r.name as string);

  for (const table of tables) {
    try {
      const row = client.get(`SELECT * FROM "${table}" WHERE id = ?`, [id]);
      if (row) {
        return Object.values(row).filter((v): v is string => typeof v === "string");
      }
    } catch {
      // Table without an `id` column (e.g. an embedded-list side table) — skip.
    }
  }

  return [];
};

/** Whether one of the stored string columns is at-rest ciphertext (proteus's
 *  `"cbor"` AES format) sealed by the given key. */
const storedUnderKey = (columns: Array<string>, keyId: string): boolean =>
  columns.some((v) => {
    try {
      return parseAes(v).keyId === keyId;
    } catch {
      return false; // not a cipher
    }
  });

const insertSubscription = (source: ProteusSource) => {
  const repository = source.repository(WebhookSubscription);
  // The client registers a PLAINTEXT secret; proteus seals it on write.
  return repository.insert(
    repository.create({
      id: "08433c77-55d1-5f11-8bb8-8c718a517b71",
      auth: WebhookAuth.ClientCredentials,
      event: "order.created",
      headers: {},
      ownerId: "d5555606-ff30-5647-aa10-54be8d2a1086",
      tenantId: null,
      url: "http://test.webhook.com/endpoint",
      authHeaders: {},
      clientId: "client-id",
      clientSecret: "plaintext-webhook-secret",
      issuer: ISSUER,
    }) as WebhookSubscription,
  );
};

describe("Pylon at-rest encryption staging", () => {
  let amphora: IAmphora;
  let source: ProteusSource;
  let pylon: Pylon;

  afterEach(async () => {
    await pylon?.teardown();
    await Promise.all(sources.map((s) => s.disconnect()));
    sources = [];
    vi.clearAllMocks();
  });

  describe("with the KEK in the vault", () => {
    let kek: IKryptos;

    beforeEach(async () => {
      amphora = new Amphora({ domain: ISSUER, logger: createMockLogger() });
      kek = kekKey();
      amphora.add([kek]);

      source = createSource(amphora);
      pylon = createPylon(amphora, source);

      await pylon.setup();
    });

    test("should round-trip Kryptos.privateKey encrypted under the staged pylon:kek", async () => {
      const repository = source.repository(Kryptos);

      const created = await repository.insert(
        repository.create({
          notBefore: new Date(),
          expiresAt: new Date(Date.now() + 3_600_000),
          algorithm: "RS256",
          type: "RSA",
          use: "sig",
          curve: null,
          encryption: null,
          privateKey: "super-secret-private-key",
          publicKey: "public-key",
          certificateChain: [],
          issuer: ISSUER,
          jwksUri: null,
          internal: true,
          ownerId: null,
          purpose: "token",
          publish: true,
        }) as Kryptos,
      );

      const columns = await rawStringColumns(source, created.id);

      // Sealed at rest under the staged pylon:kek — not the plaintext.
      expect(columns).not.toContain("super-secret-private-key");
      expect(storedUnderKey(columns, kek.id)).toBe(true);

      const found = await repository.findOne({ id: created.id });
      expect(found?.privateKey).toBe("super-secret-private-key");
    });

    test("should round-trip a plaintext webhook clientSecret under the staged pylon:kek", async () => {
      const created = await insertSubscription(source);

      const columns = await rawStringColumns(source, created.id);

      expect(columns).not.toContain("plaintext-webhook-secret");
      // Webhook secrets seal under the shared pylon:kek by default.
      expect(storedUnderKey(columns, kek.id)).toBe(true);

      // Comes back decrypted on read — dispatch does no crypto of its own.
      const found = await source
        .repository(WebhookSubscription)
        .findOne({ id: created.id });
      expect(found?.clientSecret).toBe("plaintext-webhook-secret");
    });

    test("should keep the clientSecret off the bus — carried by id, decrypted at dispatch", async () => {
      const created = await insertSubscription(source);

      const bus = createFakeBus();
      const dispatchSpy = vi.fn().mockResolvedValue(undefined);
      (createDispatchWebhook as Mock).mockReturnValue(dispatchSpy);

      await setupWebhookRequestConsumer(bus, source as any, createMockLogger());
      await setupWebhookDispatchConsumer(bus, source as any, createMockLogger());

      // Drive the request consumer: it selects matched subscriptions and
      // publishes one WebhookDispatch per match.
      await bus.handlers.get(WEBHOOK_REQUEST_QUEUE)({
        correlationId: "corr-1",
        event: "order.created",
        payload: { orderId: "123" },
        tenantId: null,
      });

      // The published message carries the id ONLY — no subscription, no secret.
      expect(bus.published).toHaveLength(1);
      const dispatchMessage = bus.published[0];
      expect(dispatchMessage.subscriptionId).toBe(created.id);
      expect(dispatchMessage).not.toHaveProperty("subscription");
      expect(dispatchMessage).not.toHaveProperty("clientSecret");
      expect(JSON.stringify(dispatchMessage)).not.toContain("plaintext-webhook-secret");

      // Drive the dispatch consumer: it reloads the row DB-locally (proteus
      // decrypts) and fans out with the decrypted secret.
      await bus.handlers.get(WEBHOOK_DISPATCH_QUEUE)(dispatchMessage);

      expect(dispatchSpy).toHaveBeenCalledTimes(1);
      const handed = dispatchSpy.mock.calls[0][0];
      expect(handed.subscription.clientSecret).toBe("plaintext-webhook-secret");
    });
  });

  test("should fail loud when a bare @Encrypted marker resolves to no key", async () => {
    // No staging, no source-level default: the entity ships as a bare marker, so
    // an unresolvable key must scream at setup rather than silently not encrypt.
    amphora = new Amphora({ domain: ISSUER, logger: createMockLogger() });
    const bareSource = track(
      new ProteusSource({
        driver: "sqlite",
        filename: ":memory:",
        entities: [Kryptos] as never,
        logger: createMockLogger(),
        synchronize: true,
        amphora,
      }),
    );

    await bareSource.connect();

    await expect(bareSource.setup()).rejects.toThrow(ProteusError);
    await expect(bareSource.setup()).rejects.toThrow(/names no encryption key/);
  });
});
