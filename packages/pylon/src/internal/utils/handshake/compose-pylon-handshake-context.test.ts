import { composePylonHandshakeContext } from "./compose-pylon-handshake-context.js";
import { describe, expect, test } from "vitest";

describe("composePylonHandshakeContext", () => {
  test("should build a handshake context", () => {
    const io = { name: "io" } as any;
    const socket = { id: "socket-1" } as any;

    const ctx = composePylonHandshakeContext(io, socket);

    expect(ctx.handshakeId).toEqual(expect.any(String));
    expect(ctx.handshakeId).toMatch(/^hsk_[A-Za-z0-9]{16}$/);
    expect(ctx.io.app).toBe(io);
    expect(ctx.io.socket).toBe(socket);
  });
});
