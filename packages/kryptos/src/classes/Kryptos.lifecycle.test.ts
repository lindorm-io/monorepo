import MockDate from "mockdate";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { TEST_EC_KEY_B64 } from "../__fixtures__/ec-keys.js";
import type { IKryptos } from "../interfaces/index.js";
import { KryptosKit } from "./KryptosKit.js";

// The pending → active → expired states are mutually exclusive and exhaustive,
// and the two boundaries are asymmetric:
//
//   notBefore  INCLUSIVE — a key is usable AT its notBefore instant
//   expiresAt  INCLUSIVE for expiry — a key is expired AT its expiresAt instant
//
// `isActive` is `isAfterOrEqual(now, notBefore) && isLive(expiresAt, now)`, so
// both ends are pinned here to the millisecond. Amphora's SIGN/SEAL floors read
// `isActive` and its VERIFY/DECRYPT floors read `isPending`, so a drift at either
// boundary silently changes which keys a crypto operation may use.
const NOW = new Date("2026-08-05T12:00:00.000Z");

const keyWith = (notBefore: Date, expiresAt: Date): IKryptos =>
  KryptosKit.from.b64({
    ...TEST_EC_KEY_B64,
    createdAt: new Date("2020-01-01T00:00:00.000Z"),
    notBefore,
    expiresAt,
  });

describe("Kryptos lifecycle boundaries", () => {
  beforeAll(() => {
    MockDate.set(NOW.toISOString());
  });

  afterAll(() => {
    MockDate.reset();
  });

  describe("notBefore boundary (inclusive — usable AT notBefore)", () => {
    test("is active at the exact notBefore instant", () => {
      const kryptos = keyWith(NOW, new Date(NOW.getTime() + 3_600_000));

      expect(kryptos.isPending).toBe(false);
      expect(kryptos.isActive).toBe(true);
      expect(kryptos.isExpired).toBe(false);
    });

    test("is pending one millisecond before notBefore", () => {
      const kryptos = keyWith(
        new Date(NOW.getTime() + 1),
        new Date(NOW.getTime() + 3_600_000),
      );

      expect(kryptos.isPending).toBe(true);
      expect(kryptos.isActive).toBe(false);
      expect(kryptos.isExpired).toBe(false);
    });
  });

  describe("expiresAt boundary (inclusive — expired AT expiresAt)", () => {
    test("is expired at the exact expiresAt instant", () => {
      const kryptos = keyWith(new Date(NOW.getTime() - 3_600_000), NOW);

      expect(kryptos.isPending).toBe(false);
      expect(kryptos.isActive).toBe(false);
      expect(kryptos.isExpired).toBe(true);
    });

    test("is still active one millisecond before expiresAt", () => {
      const kryptos = keyWith(
        new Date(NOW.getTime() - 3_600_000),
        new Date(NOW.getTime() + 1),
      );

      expect(kryptos.isPending).toBe(false);
      expect(kryptos.isActive).toBe(true);
      expect(kryptos.isExpired).toBe(false);
    });
  });

  // A zero-width window (notBefore === expiresAt === now) must not report both
  // "already usable" and "still live" — expiry wins, so the key is never active.
  test("a key whose window collapses onto now is expired, not active", () => {
    const kryptos = keyWith(NOW, NOW);

    expect(kryptos.isPending).toBe(false);
    expect(kryptos.isActive).toBe(false);
    expect(kryptos.isExpired).toBe(true);
  });
});
