import { createServer as createHttpServer } from "http";
import type { AddressInfo, Socket } from "net";
import { createServer as createNetServer } from "net";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { createLoopbackRequest } from "./loopback-request.js";

const listen = (
  server: { once: Function; listen: Function },
  ...args: Array<unknown>
): Promise<void> =>
  new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(...args, () => resolve());
  });

const close = (server: { close: Function }): Promise<void> =>
  new Promise((resolve) => server.close(() => resolve()));

describe("createLoopbackRequest", () => {
  const loopback = createLoopbackRequest();

  beforeAll(() => loopback.start());
  afterAll(() => loopback.stop());

  // ⚠ THE property. supertest dials `127.0.0.1` unconditionally
  // (`supertest/lib/test.js` serverAddress), so the server it dials must be
  // bound to `127.0.0.1` and not to the wildcard — see the platform behaviour
  // pinned below for what a wildcard bind lets happen.
  test("binds loopback, never the wildcard", () => {
    expect(loopback.address()).toBe("127.0.0.1");
  });

  test("routes a request to the registered callback", async () => {
    await loopback
      .request((_req, res) => {
        res.statusCode = 204;
        res.end();
      })
      .get("/")
      .expect(204);
  });

  test("swaps the callback per test", async () => {
    await loopback
      .request((_req, res) => {
        res.statusCode = 418;
        res.end();
      })
      .get("/")
      .expect(418);
  });
});

// The reason the fixture exists, pinned as executable fact. A wildcard bind does
// NOT conflict with a pre-existing 127.0.0.1-specific listener on BSD/macOS
// (Node sets SO_REUSEADDR), so `listen(0)` can be handed a port a foreign
// process already owns — and longest-prefix routing then delivers the
// `127.0.0.1` request to that process, not to ours.
describe("wildcard bind vs loopback dial", () => {
  const PORT = 41599;

  // A foreign app that accepts the connection and closes it, which is what a
  // listener speaking another protocol does with traffic it cannot parse.
  // `net.Server` has no `closeAllConnections`, and a half-open socket would hold
  // `close()` past the suite — so they are tracked and cut by hand.
  const sockets = new Set<Socket>();

  const squatter = createNetServer((socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    socket.end();
  });

  beforeAll(() => listen(squatter, PORT, "127.0.0.1"));

  afterAll(async () => {
    for (const socket of sockets) socket.destroy();
    await close(squatter);
  });

  test("a wildcard bind is ALLOWED over a 127.0.0.1 listener, and loses the dial", async () => {
    const ours = createHttpServer((_req, res) => {
      res.statusCode = 204;
      res.end();
    });

    await expect(listen(ours, PORT)).resolves.toBeUndefined();
    expect((ours.address() as AddressInfo).address).not.toBe("127.0.0.1");

    // Dialling the address supertest dials reaches the SQUATTER, which closes
    // the socket — the `socket hang up` this flake reported.
    await expect(
      fetch(`http://127.0.0.1:${PORT}/`).then((res) => res.status),
    ).rejects.toThrow();

    await close(ours);
  });

  test("a 127.0.0.1 bind is REFUSED, loudly and deterministically", async () => {
    const ours = createHttpServer();

    await expect(listen(ours, PORT, "127.0.0.1")).rejects.toMatchObject({
      code: "EADDRINUSE",
    });
  });
});
