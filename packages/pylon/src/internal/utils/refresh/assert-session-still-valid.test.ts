import { ClientError } from "@lindorm/errors";
import { assertSessionStillValid } from "./assert-session-still-valid.js";
import { describe, expect, test } from "vitest";

const baseSession = {
  id: "sess-1",
  accessToken: "session-jwt",
  issuedAt: new Date("2026-04-11T12:00:00.000Z"),
  scope: ["openid"],
  subject: "sub",
} as any;

describe("assertSessionStillValid", () => {
  const now = new Date("2026-04-11T12:00:00.000Z");

  test("does not throw when session is present and not expired", () => {
    const session = {
      ...baseSession,
      expiresAt: new Date("2026-04-11T13:00:00.000Z"),
    };
    expect(() => assertSessionStillValid(session, now)).not.toThrow();
  });

  test("does not throw when session has null expiresAt", () => {
    const session = { ...baseSession, expiresAt: null };
    expect(() => assertSessionStillValid(session, now)).not.toThrow();
  });

  test("throws when session is null", () => {
    expect(() => assertSessionStillValid(null, now)).toThrow(ClientError);
  });

  test("throws when session is expired", () => {
    const session = {
      ...baseSession,
      expiresAt: new Date("2026-04-11T11:59:00.000Z"),
    };
    expect(() => assertSessionStillValid(session, now)).toThrow(ClientError);
  });
});
