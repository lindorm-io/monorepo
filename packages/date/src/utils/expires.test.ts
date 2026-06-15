import MockDate from "mockdate";
import { expires } from "./expires.js";
import { describe, expect, test } from "vitest";

const MockedDate = new Date("2024-01-01T08:00:00.000Z");
MockDate.set(MockedDate);

describe("expiryObject", () => {
  test("should resolve", () => {
    expect(expires("10 minutes")).toEqual({
      expiresAt: new Date("2024-01-01T08:10:00.000Z"),
      expiresIn: 600,
      expiresOn: 1704096600,
      from: new Date("2024-01-01T08:00:00.000Z"),
      fromUnix: 1704096000,
    });
  });

  // Regression: `expires` must anchor the duration to the supplied `from`, not
  // to real-now. Previously `expires` called `expiresAt(expiry)` without
  // forwarding `from`, so `expiresAt`/`expiresOn` were computed from a fresh
  // `new Date()` while `expiresIn` used `from` — an incoherent result. The
  // `from` here is deliberately DIFFERENT from the mocked real-now so the bug
  // cannot hide behind MockDate.
  test("anchors a duration to the supplied `from`, not real-now", () => {
    const from = new Date("2030-06-15T12:00:00.000Z"); // != MockedDate

    const result = expires("1 hour", from);

    expect(result.expiresAt).toEqual(new Date("2030-06-15T13:00:00.000Z"));
    expect(result.expiresIn).toBe(3600);
    expect(result.from).toEqual(from);
    // expiresAt and expiresIn must agree about the base instant.
    expect(result.expiresOn - result.fromUnix).toBe(result.expiresIn);
  });
});
