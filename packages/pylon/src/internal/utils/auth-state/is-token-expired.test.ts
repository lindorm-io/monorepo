import { isTokenExpired } from "./is-token-expired.js";
import { describe, expect, test } from "vitest";

describe("isTokenExpired", () => {
  const now = new Date("2026-04-11T12:00:00.000Z");

  test("returns false when now is well before exp", () => {
    expect(isTokenExpired(new Date("2026-04-11T12:05:00.000Z"), now)).toMatchSnapshot();
  });

  test("returns true when now equals exp", () => {
    expect(isTokenExpired(new Date("2026-04-11T12:00:00.000Z"), now)).toMatchSnapshot();
  });

  test("returns true when now is past exp", () => {
    expect(isTokenExpired(new Date("2026-04-11T11:59:59.000Z"), now)).toMatchSnapshot();
  });

  // The boundary is inclusive to the millisecond: exp === now is EXPIRED, and a
  // single millisecond of headroom is not.
  test("returns false one millisecond before exp", () => {
    expect(isTokenExpired(new Date(now.getTime() + 1), now)).toMatchSnapshot();
  });

  test("returns true one millisecond after exp", () => {
    expect(isTokenExpired(new Date(now.getTime() - 1), now)).toMatchSnapshot();
  });
});
