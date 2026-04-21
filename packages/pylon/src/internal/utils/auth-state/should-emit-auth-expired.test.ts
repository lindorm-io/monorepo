import { shouldEmitAuthExpired } from "./should-emit-auth-expired";
import { describe, expect, test } from "vitest";

describe("shouldEmitAuthExpired", () => {
  const now = new Date("2026-04-11T12:00:00.000Z");

  test("returns true when authExpiredEmittedAt is null", () => {
    expect(shouldEmitAuthExpired({ authExpiredEmittedAt: null }, now)).toMatchSnapshot();
  });

  test("returns false when authExpiredEmittedAt is set", () => {
    expect(
      shouldEmitAuthExpired(
        { authExpiredEmittedAt: new Date("2026-04-11T11:59:59.000Z") },
        now,
      ),
    ).toMatchSnapshot();
  });
});
