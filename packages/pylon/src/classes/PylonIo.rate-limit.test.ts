// ⚠ The socket half of "mounting IS the declaration". A `rateLimit` policy block
// states the window, ceiling and strategy every mount inherits — it does NOT put
// a limiter into a deployment's event chain. `PylonIo` used to inject
// `useRateLimit()` whenever `window` and `max` were both set, which limited every
// event of every namespace with no mount anywhere saying so.
//
// Driven through a real socket.io server and a real client: the middleware array
// is private, and asserting on a private field would prove the wiring rather than
// the behaviour.

import { Amphora, type IAmphora } from "@lindorm/amphora";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { createMockProteusSource } from "@lindorm/proteus/mocks/vitest";
import { createServer, type Server as HttpServer } from "http";
import { join } from "path";
import { io as ioClient, type Socket as ClientSocket } from "socket.io-client";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { RateLimitFixed } from "../entities/RateLimitFixed.js";
import { useRateLimit } from "../middleware/common/use-rate-limit.js";
import { PylonIo } from "./PylonIo.js";

type Harness = {
  io: PylonIo;
  kv: Awaited<ReturnType<typeof createMockProteusSource>>;
  client: ClientSocket;
};

let http: HttpServer | null = null;
let harness: Harness | null = null;

const createHarness = async (options: {
  rateLimit?: Record<string, unknown>;
  middleware?: Array<any>;
}): Promise<Harness> => {
  const amphora: IAmphora = new Amphora({ logger: createMockLogger() });
  const kv = await createMockProteusSource({ entities: [RateLimitFixed] });

  http = createServer();

  const io = new PylonIo(http, {
    amphora,
    logger: createMockLogger(),
    environment: "test",
    kv: kv as any,
    rateLimit: options.rateLimit,
    socket: {
      enabled: true,
      // `echo` acks with the payload it was given, so a limited event is
      // distinguishable from an allowed one without a handler of our own.
      listeners: join(import.meta.dirname, "..", "__fixtures__", "listeners"),
      middleware: options.middleware,
    },
  } as any);

  await io.load();

  await new Promise<void>((resolve, reject) => {
    http!.once("error", reject);
    http!.listen(0, "127.0.0.1", () => {
      http!.off("error", reject);
      resolve();
    });
  });

  const address = http.address();
  const port = typeof address === "object" && address ? address.port : 0;

  const client = ioClient(`http://127.0.0.1:${port}`, {
    transports: ["websocket"],
    forceNew: true,
  });

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("connect timeout")), 5000);
    client.on("connect", () => {
      clearTimeout(timeout);
      resolve();
    });
  });

  harness = { io, kv, client };

  return harness;
};

/** The `error` event a rejected event middleware emits, or null within the window. */
const firstError = (client: ClientSocket, timeout = 500): Promise<any> =>
  new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), timeout);
    client.once("error", (data: any) => {
      clearTimeout(timer);
      resolve(data);
    });
  });

/**
 * `echo` acks with the payload it was given. A rejected event never acks, so the
 * ack times out WELL inside the test timeout and resolves to the timeout error —
 * a named failure rather than a hung test.
 */
const ack = (client: ClientSocket, payload: unknown): Promise<any> =>
  client
    .timeout(1000)
    .emitWithAck("echo", payload)
    .catch((error: Error) => ({ ackFailed: error.message }));

beforeEach(() => {
  http = null;
  harness = null;
});

afterEach(async () => {
  harness?.client.disconnect();
  harness?.io.server.close();
  await new Promise<void>((resolve) => {
    if (!http?.listening) return resolve();
    http.closeAllConnections();
    http.close(() => resolve());
  });
});

describe("PylonIo rate limit", () => {
  // ⭐ The rule: a policy block is not a mount.
  test("should NOT limit events when nothing mounts a limiter", async () => {
    const { client, kv } = await createHarness({
      rateLimit: { window: "1 minute", max: 1 },
    });

    // A limiter — had one been injected — rejects the SECOND event: it emits
    // `error` and never acks. Watch BOTH channels so a regression names the
    // cause instead of hanging on a missing ack.
    const first = await ack(client, { text: "one" });
    const rejection = firstError(client);
    const second = await ack(client, { text: "two" });

    expect(await rejection).toBeNull();
    expect(first).toMatchObject({ ok: true, data: { text: "one" } });
    expect(second).toMatchObject({ ok: true, data: { text: "two" } });
    expect(await kv.repository(RateLimitFixed).find({})).toHaveLength(0);
  });

  // …and the replacement: the deployment mounts one itself.
  test("should limit events when socket.middleware mounts a limiter", async () => {
    const { client, kv } = await createHarness({
      rateLimit: { window: "1 minute", max: 1 },
      middleware: [useRateLimit()],
    });

    expect(await ack(client, { text: "one" })).toMatchObject({
      ok: true,
      data: { text: "one" },
    });

    const rejection = firstError(client);
    client.emit("echo", { text: "two" });

    expect(await rejection).toMatchObject({ code: "rate_limit_exceeded" });
    expect(await kv.repository(RateLimitFixed).find({})).toHaveLength(1);
  });

  // The mount is inert without a policy, exactly as on the http transport.
  test("should pass through a mounted limiter when the deployment has no rateLimit block", async () => {
    const { client, kv } = await createHarness({ middleware: [useRateLimit()] });

    await ack(client, { text: "one" });

    expect(await ack(client, { text: "two" })).toMatchObject({
      ok: true,
      data: { text: "two" },
    });
    expect(await kv.repository(RateLimitFixed).find({})).toHaveLength(0);
  });
});
