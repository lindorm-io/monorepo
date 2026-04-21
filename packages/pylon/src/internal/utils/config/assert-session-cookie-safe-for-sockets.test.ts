import { PylonError } from "../../../errors/PylonError";
import { assertSessionCookieSafeForSockets } from "./assert-session-cookie-safe-for-sockets";
import { describe, expect, test } from "vitest";

describe("assertSessionCookieSafeForSockets", () => {
  test("should pass when session is not configured", () => {
    expect(() => assertSessionCookieSafeForSockets({} as any)).not.toThrow();
  });

  test("should pass when session is set and cors allowlist is explicit", () => {
    expect(() =>
      assertSessionCookieSafeForSockets({
        session: { enabled: true } as any,
        cors: { allowOrigins: ["https://app.example.com"] },
      }),
    ).not.toThrow();
  });

  test("should throw when session is set and cors is missing", () => {
    expect(() =>
      assertSessionCookieSafeForSockets({
        session: { enabled: true } as any,
      }),
    ).toThrow(PylonError);
  });

  test("should throw when session is set and cors.allowOrigins is missing", () => {
    expect(() =>
      assertSessionCookieSafeForSockets({
        session: { enabled: true } as any,
        cors: {},
      }),
    ).toThrow(PylonError);
  });

  test("should throw when session is set and cors.allowOrigins is '*'", () => {
    expect(() =>
      assertSessionCookieSafeForSockets({
        session: { enabled: true } as any,
        cors: { allowOrigins: "*" },
      }),
    ).toThrow(PylonError);
  });

  test("should throw with actionable error message", () => {
    try {
      assertSessionCookieSafeForSockets({
        session: { enabled: true } as any,
        cors: { allowOrigins: "*" },
      });
      fail("expected to throw");
    } catch (err: any) {
      expect(err).toMatchSnapshot({
        id: expect.any(String),
        timestamp: expect.any(Date),
      });
    }
  });
});
