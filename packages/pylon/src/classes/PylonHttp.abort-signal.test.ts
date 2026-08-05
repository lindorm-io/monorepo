import { createMockAmphora } from "@lindorm/amphora/mocks/vitest";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import http from "http";
import type { AddressInfo } from "net";
import { PylonHttp } from "./PylonHttp.js";
import { PylonRouter } from "./PylonRouter.js";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

describe("PylonHttp abort-signal integration", () => {
  let pylonHttp: PylonHttp;
  let server: http.Server;
  let baseUrl: string;

  const captured: {
    signal?: AbortSignal;
    reason?: unknown;
    aborted?: boolean;
  } = {};

  const capturedPost: { aborted?: boolean } = {};

  beforeAll(async () => {
    const router = new PylonRouter();

    // Regression (F13): a POST handler that awaits AFTER the body is read must
    // not have its signal aborted by the request stream's "close" (which fires
    // on body completion). The client stays connected the whole time.
    router.post("/post-await", async (ctx) => {
      capturedPost.aborted = false;
      ctx.signal.addEventListener("abort", () => {
        capturedPost.aborted = true;
      });

      // Simulate awaiting work (e.g. a DB query) after the body is consumed.
      await new Promise<void>((resolve) => setTimeout(resolve, 100));

      ctx.status = 200;
      ctx.body = { ok: true, aborted: ctx.signal.aborted };
    });

    router.get("/slow", async (ctx) => {
      captured.signal = ctx.signal;

      ctx.signal.addEventListener("abort", () => {
        captured.aborted = true;
        captured.reason = ctx.signal.reason;
      });

      // Hold the response long enough for the client to abort.
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, 1000);
        ctx.signal.addEventListener("abort", () => {
          clearTimeout(timer);
          resolve();
        });
      });

      ctx.status = 200;
      ctx.body = { ok: true };
    });

    pylonHttp = new PylonHttp({
      amphora: createMockAmphora() as any,
      logger: createMockLogger(),
      routes: { path: "/abort", router },
    });

    pylonHttp.loadMiddleware();
    await pylonHttp.loadRouters();

    server = http.createServer(pylonHttp.callback);

    await new Promise<void>((resolve) => {
      server.listen(0, () => resolve());
    });

    const addr = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  test("aborts ctx.signal with client-disconnect reason when client disconnects", async () => {
    const controller = new AbortController();

    const fetchPromise = fetch(`${baseUrl}/abort/slow`, {
      signal: controller.signal,
    });

    // Wait for the handler to attach the listener before aborting.
    await new Promise<void>((resolve) => {
      const check = setInterval(() => {
        if (captured.signal) {
          clearInterval(check);
          resolve();
        }
      }, 10);
    });

    controller.abort();

    await expect(fetchPromise).rejects.toThrow();

    // Give the server a tick to observe the close event.
    await new Promise<void>((resolve) => setTimeout(resolve, 50));

    expect(captured.signal).toBeInstanceOf(AbortSignal);
    expect(captured.aborted).toBe(true);
    expect(captured.signal?.aborted).toBe(true);
    expect(captured.reason).toEqual(
      expect.objectContaining({
        kind: "client-disconnect",
        correlationId: expect.any(String),
        requestId: expect.any(String),
      }),
    );
  });

  test("does NOT abort a POST handler that awaits after the body (client stays connected)", async () => {
    const response = await fetch(`${baseUrl}/abort/post-await`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ hello: "world" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, aborted: false });
    // The request-stream close (body fully read) must not have aborted the signal.
    expect(capturedPost.aborted).toBe(false);
  });
});
