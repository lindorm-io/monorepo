import { describe, expect, test } from "vitest";
import { crossField } from "./cross-field.js";

// The common layer is DOMAIN-keyed, so timestamps are Dates (expiresAt/
// issuedAt/notBefore), not Unix-seconds numbers.
const d = (unix: number): Date => new Date(unix * 1000);

describe("crossField", () => {
  test("passes when expiresAt > issuedAt and notBefore <= expiresAt", () => {
    expect(
      crossField({ issuedAt: d(100), notBefore: d(100), expiresAt: d(200) }),
    ).toEqual([]);
  });

  test("ignores absent timestamps", () => {
    expect(crossField({})).toEqual([]);
  });

  test("fails when expiresAt <= issuedAt", () => {
    expect(crossField({ issuedAt: d(200), expiresAt: d(200) })).toMatchSnapshot();
  });

  test("fails when notBefore > expiresAt", () => {
    expect(crossField({ notBefore: d(300), expiresAt: d(200) })).toMatchSnapshot();
  });

  // The two bounds have OPPOSITE equality boundaries, and each is load-bearing.
  describe("equality boundaries", () => {
    // exp is `isBeforeOrEqual(exp, iat)`-invalid: a token that expires the
    // millisecond it was issued has no live window at all.
    test("fails when expiresAt lands exactly on issuedAt", () => {
      const exact = new Date("2026-08-05T12:00:00.000Z");
      expect(crossField({ issuedAt: exact, expiresAt: exact })).toMatchSnapshot();
    });

    test("passes when expiresAt is one millisecond after issuedAt", () => {
      const iat = new Date("2026-08-05T12:00:00.000Z");
      expect(
        crossField({ issuedAt: iat, expiresAt: new Date(iat.getTime() + 1) }),
      ).toEqual([]);
    });

    // nbf is `isAfter(nbf, exp)`-invalid: RFC 7519 §4.1.5 admits a token AT its
    // nbf, so nbf === exp is a legal (if instantaneous) window. Swapping this to
    // an isExpired/isLive-style bound would reject a valid envelope.
    test("passes when notBefore lands exactly on expiresAt", () => {
      const exact = new Date("2026-08-05T12:00:00.000Z");
      expect(crossField({ notBefore: exact, expiresAt: exact })).toEqual([]);
    });

    test("fails when notBefore is one millisecond after expiresAt", () => {
      const exp = new Date("2026-08-05T12:00:00.000Z");
      expect(
        crossField({ notBefore: new Date(exp.getTime() + 1), expiresAt: exp }),
      ).toMatchSnapshot();
    });
  });
});
