import { resolveHttpTokenSource } from "./resolve-http-token-source";
import { describe, expect, test } from "vitest";

const session = {
  id: "sess-1",
  accessToken: "session-jwt",
  expiresAt: new Date("2026-04-11T13:00:00.000Z"),
  issuedAt: new Date("2026-04-11T12:00:00.000Z"),
  scope: ["openid"],
  subject: "sub",
} as any;

const makeCtx = (overrides: any = {}): any => ({
  state: {
    authorization: { type: "none", value: null },
    session: null,
    ...overrides,
  },
});

describe("resolveHttpTokenSource", () => {
  test("returns bearer kind when authorization is bearer", () => {
    const ctx = makeCtx({ authorization: { type: "bearer", value: "bearer-jwt" } });
    expect(resolveHttpTokenSource(ctx)).toMatchSnapshot();
  });

  test("returns dpop kind when authorization is dpop", () => {
    const ctx = makeCtx({ authorization: { type: "dpop", value: "dpop-jwt" } });
    expect(resolveHttpTokenSource(ctx)).toMatchSnapshot();
  });

  test("returns session kind when session has accessToken and no header", () => {
    const ctx = makeCtx({ session });
    expect(resolveHttpTokenSource(ctx)).toMatchSnapshot();
  });

  test("prefers bearer over session when both present", () => {
    const ctx = makeCtx({
      authorization: { type: "bearer", value: "bearer-jwt" },
      session,
    });
    expect(resolveHttpTokenSource(ctx)).toMatchSnapshot();
  });

  test("returns none when nothing available", () => {
    expect(resolveHttpTokenSource(makeCtx())).toMatchSnapshot();
  });
});
