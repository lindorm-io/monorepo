import { PylonError } from "../../../errors/PylonError.js";
import { assertSessionCookieSafeForSockets } from "./assert-session-cookie-safe-for-sockets.js";
import { describe, expect, test } from "vitest";

describe("assertSessionCookieSafeForSockets", () => {
  test("should pass when session is not configured", () => {
    expect(() => assertSessionCookieSafeForSockets({} as any)).not.toThrow();
  });

  // `auth` without a `session` block mounts no session cookie, so the CSWSH
  // guard has nothing to protect — a pure resource server may keep a wildcard.
  test("should pass when auth is configured without a session", () => {
    expect(() =>
      assertSessionCookieSafeForSockets({
        auth: { driver: {} } as any,
        cors: { allowOrigins: "*" },
      }),
    ).not.toThrow();
  });

  test("should pass when session is set and cors allowlist is explicit", () => {
    expect(() =>
      assertSessionCookieSafeForSockets({
        auth: { session: { enabled: true } } as any,
        cors: { allowOrigins: ["https://app.example.com"] },
      }),
    ).not.toThrow();
  });

  test("should throw when session is set and cors is missing", () => {
    expect(() =>
      assertSessionCookieSafeForSockets({
        auth: { session: { enabled: true } } as any,
      }),
    ).toThrow(PylonError);
  });

  test("should throw when session is set and cors.allowOrigins is missing", () => {
    expect(() =>
      assertSessionCookieSafeForSockets({
        auth: { session: { enabled: true } } as any,
        cors: {},
      }),
    ).toThrow(PylonError);
  });

  test("should throw when session is set and cors.allowOrigins is '*'", () => {
    expect(() =>
      assertSessionCookieSafeForSockets({
        auth: { session: { enabled: true } } as any,
        cors: { allowOrigins: "*" },
      }),
    ).toThrow(PylonError);
  });

  test("should throw with actionable error message", () => {
    try {
      assertSessionCookieSafeForSockets({
        auth: { session: { enabled: true } } as any,
        cors: { allowOrigins: "*" },
      });
      expect.fail("expected to throw");
    } catch (err: any) {
      expect(err).toMatchSnapshot({
        id: expect.any(String),
        support: expect.any(String),
        timestamp: expect.any(Date),
      });
    }
  });
});
