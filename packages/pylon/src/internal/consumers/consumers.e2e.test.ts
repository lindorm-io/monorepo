// ⭐ Every pylon consumer, driven by REAL delivery through a real in-memory
// iris and a real in-memory proteus.
//
// The existing per-consumer tests reach past routing entirely — they pull the
// handler out of a fake bus (`bus.handlers.get(QUEUE)`) and call it. A mock
// echoing a mock: it cannot see whether the message the publisher emitted ever
// arrives at the topic the consumer bound, which is exactly the fault that kept
// every audit and webhook record out of the database. So nothing here invokes a
// handler by hand; each test publishes the way production publishes and then
// asserts on the row that landed.

import { randomUUID } from "crypto";
import { createMockIrisSource } from "@lindorm/iris/mocks/vitest";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { isObject } from "@lindorm/is";
import { createMockProteusSource } from "@lindorm/proteus/mocks/vitest";
import type { IncomingMessage, Server, ServerResponse } from "http";
import { createServer } from "http";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { WebhookAuth, WebhookMethod } from "../../enums/index.js";
import { DataAuditLog } from "../../entities/DataAuditLog.js";
import { RequestAuditLog } from "../../entities/RequestAuditLog.js";
import { WebhookSubscription } from "../../entities/WebhookSubscription.js";
import { DataAuditChange } from "../../messages/DataAuditChange.js";
import { RequestAudit } from "../../messages/RequestAudit.js";
import { WebhookDispatch } from "../../messages/WebhookDispatch.js";
import { WebhookRequest } from "../../messages/WebhookRequest.js";
import { setupDataAuditListeners } from "../listeners/setup-data-audit-listeners.js";
import { setupAuditConsumer } from "./setup-audit-consumer.js";
import { setupDataAuditConsumer } from "./setup-data-audit-consumer.js";
import { setupWebhookDispatchConsumer } from "./setup-webhook-dispatch-consumer.js";
import { setupWebhookRequestConsumer } from "./setup-webhook-request-consumer.js";

// Consumers are fire-and-forget behind an `await publish`, so the row lands a
// tick or two later. Poll rather than sleep a fixed amount.
const waitFor = async (predicate: () => Promise<boolean> | boolean): Promise<void> => {
  for (let i = 0; i < 200; i++) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
};

type Received = { url: string; body: string };

describe("pylon consumers end to end", () => {
  let bus: any;
  let db: any;
  let logger: any;

  // `WebhookSubscription.id` is a bare `@PrimaryKeyField` — proteus generates
  // nothing for it, so the id is the caller's to supply.
  const insertSubscription = async (url: string): Promise<any> => {
    const repo = db.repository(WebhookSubscription);

    return repo.insert(
      repo.create({
        id: randomUUID(),
        auth: WebhookAuth.None,
        event: "order.created",
        method: WebhookMethod.Post,
        headers: {},
        ownerId: "owner-1",
        tenantId: null,
        url,
        authHeaders: {},
      }),
    );
  };

  beforeEach(async () => {
    logger = createMockLogger();

    bus = await createMockIrisSource({
      messages: [RequestAudit, DataAuditChange, WebhookRequest, WebhookDispatch],
    });

    db = await createMockProteusSource({
      entities: [RequestAuditLog, DataAuditLog, WebhookSubscription],
    });
  });

  describe("request audit", () => {
    test("should persist a published RequestAudit to the database", async () => {
      await setupAuditConsumer(bus, db, logger);

      const wq = bus.workerQueue(RequestAudit);

      await wq.publish(
        wq.create({
          requestId: "req-1",
          correlationId: "corr-1",
          actor: "user@test.lindorm.io",
          appName: "e2e",
          endpoint: "/v1/ok",
          method: "GET",
          transport: "http",
          statusCode: 200,
          duration: 12,
          sourceIp: "127.0.0.1",
          requestBody: null,
          sessionId: null,
          client: null,
          errorCode: null,
          errorType: null,
        }),
      );

      const repo = db.repository(RequestAuditLog);

      await waitFor(async () => (await repo.find({ requestId: "req-1" })).length > 0);

      const [row] = await repo.find({ requestId: "req-1" });

      expect(row).toMatchObject({
        requestId: "req-1",
        correlationId: "corr-1",
        actor: "user@test.lindorm.io",
        endpoint: "/v1/ok",
        method: "GET",
        statusCode: 200,
      });
    });
  });

  describe("data audit", () => {
    // Driven the way production drives it: a real proteus write fires the
    // `entity:after-*` listener, which publishes, which the consumer persists.
    test("should persist a DataAuditChange raised by a real entity insert", async () => {
      await setupDataAuditListeners(db, bus, [WebhookSubscription], logger);
      await setupDataAuditConsumer(bus, db, logger);

      const created = await insertSubscription("https://webhook.test.lindorm.io/hook");

      const repo = db.repository(DataAuditLog);

      await waitFor(async () => (await repo.find({ entityId: created.id })).length > 0);

      const [row] = await repo.find({ entityId: created.id });

      expect(row).toMatchObject({
        entityName: "WebhookSubscription",
        entityNamespace: "pylon",
        entityId: created.id,
        action: "insert",
      });
    });

    test("should persist the field diff of a real entity update", async () => {
      const created = await insertSubscription("https://webhook.test.lindorm.io/hook");

      // Registered AFTER the insert so only the update is audited.
      await setupDataAuditListeners(db, bus, [WebhookSubscription], logger);
      await setupDataAuditConsumer(bus, db, logger);

      // Reloaded, mutated, saved — the same shape the webhook dispatch
      // consumer uses when it writes an error back.
      const subscription = await db
        .repository(WebhookSubscription)
        .findOne({ id: created.id });
      subscription.event = "order.shipped";
      await db.repository(WebhookSubscription).save(subscription);

      const repo = db.repository(DataAuditLog);

      await waitFor(async () => (await repo.find({ action: "update" })).length > 0);

      const [row] = await repo.find({ action: "update" });

      expect(row).toMatchObject({ entityId: created.id, action: "update" });

      // The diff itself carries `Date` values (`updatedAt` moves on every
      // versioned write). A plain json column rejects those outright, which is
      // why `changes` is `@TypedJson` — this asserts the Date survived the
      // round trip as a Date rather than being flattened or refused.
      expect(row.changes.updatedAt.to).toBeInstanceOf(Date);
    });
  });

  describe("webhook", () => {
    let server: Server;
    let received: Array<Received>;
    let status: number;

    const url = (): string => {
      const addr = server.address();

      if (isObject(addr)) return `http://127.0.0.1:${addr.port}/hook`;

      throw new Error("Webhook target server is not bound — call listen() first");
    };

    const handler = (req: IncomingMessage, res: ServerResponse): void => {
      const chunks: Array<Buffer> = [];
      req.on("data", (chunk) => chunks.push(chunk));
      req.on("end", () => {
        received.push({
          url: req.url ?? "",
          body: Buffer.concat(chunks).toString("utf8"),
        });
        res.statusCode = status;
        res.end("{}");
      });
    };

    beforeAll(
      () =>
        new Promise<void>((resolve, reject) => {
          server = createServer(handler);
          server.once("error", reject);
          server.listen(0, "127.0.0.1", () => {
            server.off("error", reject);
            resolve();
          });
        }),
    );

    afterAll(
      () =>
        new Promise<void>((resolve, reject) => {
          server.closeAllConnections();
          server.close((err) => (err ? reject(err) : resolve()));
        }),
    );

    beforeEach(() => {
      received = [];
      status = 200;
    });

    // The full chain: WebhookRequest -> the request consumer fans out one
    // WebhookDispatch per matched subscription -> the dispatch consumer loads
    // the row and performs the real HTTP call. Both hops go over the bus.
    test("should fan a published WebhookRequest out to a real HTTP dispatch", async () => {
      await insertSubscription(url());

      await setupWebhookRequestConsumer(bus, db, logger);
      await setupWebhookDispatchConsumer(bus, db, logger);

      const wq = bus.workerQueue(WebhookRequest);

      await wq.publish(
        wq.create({
          correlationId: "corr-1",
          event: "order.created",
          payload: { orderId: "123" },
          tenantId: null,
        }),
      );

      await waitFor(() => received.length > 0);

      expect(received).toHaveLength(1);
      expect(received[0].url).toContain("event=order.created");
      expect(JSON.parse(received[0].body)).toEqual({ orderId: "123" });
    });

    // The dispatch consumer's only DATABASE effect is on failure, so this is
    // what proves a WebhookDispatch reached it rather than vanishing: the row
    // it wrote back.
    test("should record a failed dispatch on the subscription row", async () => {
      const created = await insertSubscription(url());

      status = 500;

      await setupWebhookDispatchConsumer(bus, db, logger);

      const wq = bus.workerQueue(WebhookDispatch);

      await wq.publish(
        wq.create({
          correlationId: "corr-1",
          event: "order.created",
          payload: { orderId: "123" },
          subscriptionId: created.id,
        }),
      );

      const repo = db.repository(WebhookSubscription);

      await waitFor(async () => {
        const row = await repo.findOne({ id: created.id });
        return (row?.errorCount ?? 0) > 0;
      });

      const row = await repo.findOne({ id: created.id });

      expect(row?.errorCount).toBe(1);
      expect(row?.lastErrorAt).toBeInstanceOf(Date);
    });

    test("should suspend a subscription once it reaches maxErrors", async () => {
      const created = await insertSubscription(url());

      status = 500;

      await setupWebhookDispatchConsumer(bus, db, logger, { maxErrors: 1 });

      const wq = bus.workerQueue(WebhookDispatch);

      await wq.publish(
        wq.create({
          correlationId: "corr-1",
          event: "order.created",
          payload: { orderId: "123" },
          subscriptionId: created.id,
        }),
      );

      const repo = db.repository(WebhookSubscription);

      await waitFor(async () => {
        const row = await repo.findOne({ id: created.id });
        return row?.suspendedAt != null;
      });

      const row = await repo.findOne({ id: created.id });

      expect(row?.suspendedAt).toBeInstanceOf(Date);
    });
  });
});
