import { isInExpiryWarningWindow } from "./is-in-expiry-warning-window";
import { describe, expect, test } from "vitest";

describe("isInExpiryWarningWindow", () => {
  const now = new Date("2026-04-11T12:00:00.000Z");
  const warningMs = 60_000;

  test("returns false when well before warning window", () => {
    expect(
      isInExpiryWarningWindow(new Date("2026-04-11T12:05:00.000Z"), now, warningMs),
    ).toMatchSnapshot();
  });

  test("returns true when exactly at the warning window edge", () => {
    expect(
      isInExpiryWarningWindow(new Date("2026-04-11T12:01:00.000Z"), now, warningMs),
    ).toMatchSnapshot();
  });

  test("returns true when inside the warning window", () => {
    expect(
      isInExpiryWarningWindow(new Date("2026-04-11T12:00:30.000Z"), now, warningMs),
    ).toMatchSnapshot();
  });

  test("returns false when now equals exp (past-expiry)", () => {
    expect(
      isInExpiryWarningWindow(new Date("2026-04-11T12:00:00.000Z"), now, warningMs),
    ).toMatchSnapshot();
  });

  test("returns false when past exp", () => {
    expect(
      isInExpiryWarningWindow(new Date("2026-04-11T11:59:00.000Z"), now, warningMs),
    ).toMatchSnapshot();
  });
});
