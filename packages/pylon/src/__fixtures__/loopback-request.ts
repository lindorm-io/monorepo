import { isObject } from "@lindorm/is";
import type { RequestListener, Server } from "http";
import { createServer } from "http";
import request from "supertest";

export type LoopbackRequest = {
  /** Bind the loopback server. Call from `beforeAll`. */
  start(): Promise<void>;
  /** Close it. Call from `afterAll`. */
  stop(): Promise<void>;
  /** A supertest agent for `callback`, dialled on the address it is bound to. */
  request(callback: RequestListener): ReturnType<typeof request>;
  /** The bound address, so a test can assert it is loopback and not the wildcard. */
  address(): string;
};

/**
 * supertest binds the WILDCARD and dials `127.0.0.1`. Its `serverAddress`
 * (`supertest/lib/test.js`) is literally:
 *
 *     if (!addr) this._server = app.listen(0);
 *     return protocol + '://127.0.0.1:' + port + path;
 *
 * — `listen(0)` with no host, then a loopback dial. On BSD and macOS a wildcard
 * bind does NOT conflict with a pre-existing `127.0.0.1`-specific listener
 * (SO_REUSEADDR, which Node sets), so the kernel is free to hand out a port
 * another process already owns. Longest-prefix routing then delivers the
 * `127.0.0.1` request to THAT process, and the answer is whatever it does with
 * traffic it cannot parse — usually closing the socket, which surfaces as
 * `socket hang up` against a pylon that is up and perfectly healthy.
 *
 * The cure is to bind the SAME address the request dials. Then an owned port is
 * `EADDRINUSE` at bind time: loud, immediate and deterministic, instead of one
 * test failing for a reason that is nowhere in the codebase.
 *
 * ONE server is bound per test file and its handler is swapped per test, because
 * binding is asynchronous while `request(...)` builds its URL synchronously in
 * the `Test` constructor. Safe because vitest runs the tests within a file
 * sequentially — do not reach for `test.concurrent` in a file that uses this.
 */
export const createLoopbackRequest = (): LoopbackRequest => {
  let callback: RequestListener | null = null;

  const server: Server = createServer((req, res) => {
    if (!callback) {
      res.statusCode = 500;
      res.end("loopback request used before a callback was registered");
      return;
    }

    callback(req, res);
  });

  const address = (): string => {
    const addr = server.address();

    if (isObject(addr)) return addr.address;

    throw new Error("Loopback server is not bound — call start() first");
  };

  return {
    start: () =>
      new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", () => {
          server.off("error", reject);
          resolve();
        });
      }),

    stop: () =>
      new Promise<void>((resolve, reject) => {
        // One server serves a whole file, so it accumulates keep-alive sockets
        // that would hold `close` open past the suite. Every test has finished
        // by the time this runs, so there is nothing in flight to cut.
        server.closeAllConnections();
        server.close((err) => (err ? reject(err) : resolve()));
      }),

    request: (next) => {
      callback = next;
      // The server is already listening, so supertest reads its address instead
      // of binding a second one of its own.
      return request(server);
    },

    address,
  };
};
