// ⭐ Audit records the requests that FAILED, end to end through a real chain.
//
// This is deliberately not a mocked `next` that throws. The part that has to be
// proven is the INTERACTION with `httpErrorHandlerMiddleware`, which pylon mounts
// in its global chain ABOVE every route middleware: the error escapes the route,
// passes out through `useAuditLog`'s frame, and only THEN does the handler map it
// to a status. So a mocked `next` cannot show either of the two things that
// matter — that the record is written at all, and that the status on it is the
// one the client actually received.
//
// Before the fix `useAuditLog` published after a bare `await next()`, so every
// 401 / 403 / 429 / 500 left NO record. An audit log that silently drops every
// denial is worse than none, because it still looks complete.

import { createMockAmphora } from "@lindorm/amphora/mocks/vitest";
import { ClientError } from "@lindorm/errors";
import { createMockIrisSource } from "@lindorm/iris/mocks/vitest";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { RedirectError } from "../errors/index.js";
import { AUDIT_QUEUE } from "../internal/consumers/setup-audit-consumer.js";
import { createLoopbackRequest } from "../__fixtures__/loopback-request.js";
import { RequestAudit } from "../messages/RequestAudit.js";
import { useAuditLog } from "../middleware/common/use-audit-log.js";
import { PylonHttp } from "./PylonHttp.js";
import { PylonRouter } from "./PylonRouter.js";

const createRouter = (): PylonRouter => {
  const router = new PylonRouter();

  router.get("/ok", useAuditLog(), async (ctx) => {
    ctx.status = 200;
    ctx.body = { ok: true };
  });

  // The denial an auditor most wants: a real client error carrying its own
  // status and code, thrown from inside the route.
  router.post("/denied", useAuditLog(), async () => {
    throw new ClientError("Insufficient scope", {
      status: ClientError.Status.Forbidden,
      code: "insufficient_scope",
      type: "urn:lindorm:pylon:error:insufficient_scope",
    });
  });

  // A bare `Error` — no status, no code — which the handler answers 500.
  router.get("/boom", useAuditLog(), async () => {
    throw new Error("kaboom");
  });

  // The one error the handler answers with a RESPONSE rather than a status.
  router.get("/redirect", useAuditLog(), async () => {
    throw new RedirectError("Access denied", {
      redirect: "https://client.test.lindorm.io/cb",
      code: "access_denied",
    });
  });

  return router;
};

const createPylonHttp = async (bus: any): Promise<PylonHttp> => {
  const pylonHttp = new PylonHttp({
    amphora: createMockAmphora() as any,
    logger: createMockLogger(),
    routes: { path: "/v1", router: createRouter() },
    audit: {},
    bus,
  } as any);

  pylonHttp.loadMiddleware();
  await pylonHttp.loadRouters();

  return pylonHttp;
};

/**
 * ⚠ The topic `RequestAudit` is actually PUBLISHED to, which is neither what the
 * `@Topic` callback spells nor what `setupAuditConsumer` listens on:
 * `resolveTopic` prefixes the `@Namespace("pylon")` onto a callback that already
 * begins `pylon.`, so `pylon.audit.request` goes out as `pylon.pylon.audit.request`.
 *
 * This file subscribes on the REAL topic so it tests the middleware and nothing
 * else. The consumer-side mismatch is pinned separately, at the bottom.
 */
const PUBLISHED_TOPIC = "pylon.pylon.audit.request";

const loopback = createLoopbackRequest();

beforeAll(() => loopback.start());
afterAll(() => loopback.stop());

describe("PylonHttp audit log over a real error-handled chain", () => {
  let bus: any;
  let pylonHttp: PylonHttp;
  let records: Array<RequestAudit>;

  /**
   * The publish is fire-and-forget by design (an audit write must never hold a
   * response open), so the record lands a tick or two after the response. Poll
   * rather than sleep a fixed amount.
   */
  const awaitRecords = async (count: number): Promise<Array<RequestAudit>> => {
    for (let i = 0; i < 100; i++) {
      if (records.length >= count) return records;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    return records;
  };

  beforeEach(async () => {
    records = [];

    bus = await createMockIrisSource({ messages: [RequestAudit] });

    await bus.messageBus(RequestAudit).subscribe({
      topic: PUBLISHED_TOPIC,
      queue: "test.audit",
      callback: async (message: any) => {
        records.push(message);
      },
    });

    pylonHttp = await createPylonHttp(bus);
  });

  test("should audit a successful request with the status the client saw", async () => {
    await loopback.request(pylonHttp.callback).get("/v1/ok").expect(200);

    const [record] = await awaitRecords(1);

    expect(record).toMatchObject({
      endpoint: "/v1/ok",
      method: "GET",
      transport: "http",
      statusCode: 200,
      errorCode: null,
      errorType: null,
    });
  });

  // ⭐ THE regression. A 403 used to leave nothing behind at all.
  test("should audit a request denied downstream, and still return the original error", async () => {
    const response = await loopback
      .request(pylonHttp.callback)
      .post("/v1/denied")
      .send({ hello: "world" })
      .expect(403);

    // The error reaches the client untouched — auditing it changed nothing.
    expect(response.body.error).toMatchObject({
      code: "insufficient_scope",
      type: "urn:lindorm:pylon:error:insufficient_scope",
      message: "Insufficient scope",
    });

    const [record] = await awaitRecords(1);

    expect(record).toMatchObject({
      endpoint: "/v1/denied",
      method: "POST",
      transport: "http",
      // ⚠ 403, not the 404 koa still had on `ctx.status` when audit's frame
      // unwound, and not a misleading 200.
      statusCode: 403,
      errorCode: "insufficient_scope",
      errorType: "urn:lindorm:pylon:error:insufficient_scope",
      requestBody: { hello: "world" },
    });
  });

  test("should audit an unhandled exception as the 500 the client received", async () => {
    const response = await loopback
      .request(pylonHttp.callback)
      .get("/v1/boom")
      .expect(500);

    expect(response.body.error.message).toBe("kaboom");

    const [record] = await awaitRecords(1);

    expect(record).toMatchObject({
      endpoint: "/v1/boom",
      statusCode: 500,
      // No code on a bare Error — the record names the same fallback the
      // response body does, so the two can be reconciled.
      errorCode: "unknown_error",
      errorType: "urn:lindorm:error:unknown_error",
    });
  });

  // A `RedirectError` is the one failure that never becomes an error status:
  // the client gets a clean 302 carrying `error=access_denied`. Recording it as
  // a 500 would say the server broke when it did not.
  test("should audit a redirect error as the 302 the client received", async () => {
    await loopback.request(pylonHttp.callback).get("/v1/redirect").expect(302);

    const [record] = await awaitRecords(1);

    expect(record).toMatchObject({
      endpoint: "/v1/redirect",
      statusCode: 302,
      errorCode: "access_denied",
    });
  });

  // ⛔ NOT a property worth having — a PIN on a defect this fix could not carry.
  //
  // `resolveTopic` prefixes `@Namespace("pylon")` onto a `@Topic` callback that
  // already begins `pylon.`, so records go out on `pylon.pylon.audit.request`.
  // `setupAuditConsumer` meanwhile consumes on queue `pylon.audit.request.persist`
  // — and iris's `resolveConsumeTopic` uses the QUEUE STRING as the topic when a
  // message has a dynamic `@Topic` callback. The two never meet, so nothing has
  // ever reached `RequestAuditLog`. All four pylon consumers are shaped this way.
  //
  // Left unfixed on purpose: the repair changes broker-visible topic and queue
  // names (or iris's `@Topic`), which is a design call, not a bug fix. WHEN it is
  // made this test fails — deliberately, so the pairing gets re-derived rather
  // than this stale expectation being carried forward.
  test("PINS the publish/consume topic mismatch that keeps records out of the db", async () => {
    const consumed: Array<unknown> = [];

    await bus
      .workerQueue(RequestAudit)
      .consume(AUDIT_QUEUE, async (message: any) => void consumed.push(message));

    await loopback.request(pylonHttp.callback).get("/v1/ok").expect(200);
    await awaitRecords(1);

    // Published — and received by nothing on the consumer's topic.
    expect(records).toHaveLength(1);
    expect(consumed).toHaveLength(0);
  });

  // The record carries the error's identity, never its stack or message — a
  // message is interpolated at the throw site and can hold request values the
  // `sanitise` hook never sees.
  test("should never carry the error message or stack onto the record", async () => {
    await loopback
      .request(pylonHttp.callback)
      .post("/v1/denied")
      .send({ hello: "world" })
      .expect(403);

    const [record] = await awaitRecords(1);

    expect(JSON.stringify(record)).not.toContain("Insufficient scope");
    expect(record).not.toHaveProperty("errorMessage");
    expect(record).not.toHaveProperty("errorStack");
  });
});
