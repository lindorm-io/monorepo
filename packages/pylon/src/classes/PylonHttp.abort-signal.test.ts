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

  beforeAll(async () => {
    const router = new PylonRouter();

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
});
