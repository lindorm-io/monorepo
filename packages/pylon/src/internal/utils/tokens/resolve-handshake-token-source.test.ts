import { resolveHandshakeTokenSource } from "./resolve-handshake-token-source";
import { describe, expect, test } from "vitest";

const session = {
  id: "sess-1",
  accessToken: "session-jwt",
  expiresAt: new Date("2026-04-11T13:00:00.000Z"),
  issuedAt: new Date("2026-04-11T12:00:00.000Z"),
  scope: ["openid"],
  subject: "sub",
} as any;

const makeSocket = (overrides: any = {}): any => ({
  handshake: {
    auth: {},
    headers: {},
    ...overrides.handshake,
  },
  data: overrides.data ?? {},
});

describe("resolveHandshakeTokenSource", () => {
  test("returns bearer when handshake.auth.bearer is present", () => {
    const socket = makeSocket({ handshake: { auth: { bearer: "jwt" } } });
    expect(resolveHandshakeTokenSource(socket)).toMatchSnapshot();
  });

  test("returns dpop when handshake.auth.bearer and dpop header both present", () => {
    const socket = makeSocket({
      handshake: { auth: { bearer: "jwt" }, headers: { dpop: "proof" } },
    });
    expect(resolveHandshakeTokenSource(socket)).toMatchSnapshot();
  });

  test("returns session when no handshake bearer and socket.data.session present", () => {
    const socket = makeSocket({ data: { session } });
    expect(resolveHandshakeTokenSource(socket)).toMatchSnapshot();
  });

  test("prefers bearer over session when both present", () => {
    const socket = makeSocket({
      handshake: { auth: { bearer: "jwt" } },
      data: { session },
    });
    expect(resolveHandshakeTokenSource(socket)).toMatchSnapshot();
  });

  test("returns none when nothing available", () => {
    expect(resolveHandshakeTokenSource(makeSocket())).toMatchSnapshot();
  });

  test("handles array-valued dpop header", () => {
    const socket = makeSocket({
      handshake: { auth: { bearer: "jwt" }, headers: { dpop: ["proof-a", "proof-b"] } },
    });
    expect(resolveHandshakeTokenSource(socket)).toMatchSnapshot();
  });
});
