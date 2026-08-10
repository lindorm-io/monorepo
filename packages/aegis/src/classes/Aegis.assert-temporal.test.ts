import { Amphora } from "@lindorm/amphora";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import type { Dict } from "@lindorm/types";
import MockDate from "mockdate";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { TEST_EC_KEY_SIG } from "../__fixtures__/keys.js";
import type { AssertOptions, DomainAssert } from "../types/index.js";
import { Aegis } from "./Aegis.js";

const MINTED_AT = new Date("2024-01-01T08:00:00.000Z");
const EXPIRES_AT = new Date("2024-01-01T09:00:00.000Z");
const EXPIRED_BY_TEN_SECONDS = new Date("2024-01-01T09:00:10.000Z");
const LONG_EXPIRED = new Date("2024-01-01T12:00:00.000Z");

const ISSUER = "https://test.lindorm.io/";
const AUDIENCE = "https://rs.lindorm.io/";

/**
 * `assert` is verify's claim checking WITHOUT the signature — so the temporal
 * window is part of it, from the same builder and with the same defaults. What
 * this retires is a consumer hand-rolling `exp > now`: such a check carries no
 * clock tolerance, so a token inside verify's skew window passes the verified
 * arm and fails the hand-rolled one.
 */
describe("Aegis.assert — the temporal family", () => {
  const live = { expiresAt: EXPIRES_AT, subject: "user-1" };
  // Strictly before "now": the `exp` bound is `>= now - tolerance`, so a claim
  // set expiring exactly at `now` is still live.
  const expired = { expiresAt: new Date("2024-01-01T07:00:00.000Z"), subject: "user-1" };

  beforeEach(() => MockDate.set(MINTED_AT));
  afterEach(() => MockDate.set(MINTED_AT));

  describe("expiration", () => {
    test("should accept a live claim set", () => {
      expect(Aegis.matches(live, { subject: "user-1" })).toBe(true);
    });

    test("should reject an expired claim set by default", () => {
      expect(Aegis.matches(expired, { subject: "user-1" })).toBe(false);
      expect(() => Aegis.assert(expired, { subject: "user-1" })).toThrow();
    });

    test("should name expiresAt as the failing claim", () => {
      try {
        Aegis.assert(expired, { subject: "user-1" });
        throw new Error("expected assert to throw");
      } catch (err: any) {
        expect(err.data.invalid).toEqual(["expiresAt"]);
      }
    });

    test("should tolerate a claim set with no expiresAt at all", () => {
      expect(Aegis.matches({ subject: "user-1" }, { subject: "user-1" })).toBe(true);
    });

    test("should accept an expired claim set when the range check is off", () => {
      expect(
        Aegis.matches(expired, { subject: "user-1" }, { verifyExpiration: false }),
      ).toBe(true);
    });
  });

  describe("clockTolerance", () => {
    test("should accept a claim set expired within the tolerance", () => {
      MockDate.set(EXPIRED_BY_TEN_SECONDS);

      expect(Aegis.matches(live, { subject: "user-1" }, { clockTolerance: 60 })).toBe(
        true,
      );
    });

    test("should reject a claim set expired beyond the tolerance", () => {
      MockDate.set(EXPIRED_BY_TEN_SECONDS);

      expect(Aegis.matches(live, { subject: "user-1" }, { clockTolerance: 5 })).toBe(
        false,
      );
    });
  });

  describe("currentDate", () => {
    test("should judge against the supplied instant", () => {
      MockDate.set(LONG_EXPIRED);

      expect(Aegis.matches(live, { subject: "user-1" })).toBe(false);
      expect(Aegis.matches(live, { subject: "user-1" }, { currentDate: MINTED_AT })).toBe(
        true,
      );
    });
  });

  describe("notBefore and authTime", () => {
    test("should reject a claim set not yet valid", () => {
      expect(
        Aegis.matches(
          { ...live, notBefore: new Date("2024-01-01T08:30:00.000Z") },
          { subject: "user-1" },
        ),
      ).toBe(false);
    });

    test("should accept it once nbf has passed", () => {
      MockDate.set(new Date("2024-01-01T08:45:00.000Z"));

      expect(
        Aegis.matches(
          { ...live, notBefore: new Date("2024-01-01T08:30:00.000Z") },
          { subject: "user-1" },
        ),
      ).toBe(true);
    });

    test("should skip the nbf bound when told to", () => {
      expect(
        Aegis.matches(
          { ...live, notBefore: new Date("2024-01-01T08:30:00.000Z") },
          { subject: "user-1" },
          { verifyNotBefore: false },
        ),
      ).toBe(true);
    });

    test("should reject an authTime in the future", () => {
      expect(
        Aegis.matches(
          { ...live, authTime: new Date("2024-01-01T08:30:00.000Z") },
          { subject: "user-1" },
          { verifyAuthTime: true },
        ),
      ).toBe(false);
    });
  });

  describe("maxTokenAge", () => {
    const claims = { ...live, issuedAt: MINTED_AT };

    test("should accept a fresh claim set", () => {
      MockDate.set(new Date("2024-01-01T08:05:00.000Z"));

      expect(Aegis.matches(claims, { subject: "user-1" }, { maxTokenAge: 600 })).toBe(
        true,
      );
    });

    test("should reject a stale claim set", () => {
      MockDate.set(new Date("2024-01-01T08:30:00.000Z"));

      expect(Aegis.matches(claims, { subject: "user-1" }, { maxTokenAge: 600 })).toBe(
        false,
      );
    });

    test("should require issuedAt to be present", () => {
      expect(Aegis.matches(live, { subject: "user-1" }, { maxTokenAge: 600 })).toBe(
        false,
      );
    });
  });

  // A caller matcher on a temporal claim is spread last, so it replaces the
  // range bound rather than fighting it.
  describe("caller override", () => {
    test("should let an explicit expiresAt matcher win", () => {
      expect(
        Aegis.matches(expired, { expiresAt: { $lte: EXPIRES_AT } } as DomainAssert),
      ).toBe(true);
    });
  });
});

/**
 * The test that proves the split is right: the SAME claims, the SAME assert, the
 * SAME options — `aegis.verify` (over the wire payload, JOSE names) and
 * `Aegis.assert` (over the domain claims, domain names) must reach the same
 * verdict every time.
 */
describe("Aegis.assert and aegis.verify agree", () => {
  let aegis: Aegis;
  let token: string;

  beforeEach(async () => {
    MockDate.set(MINTED_AT);

    const logger = createMockLogger();
    const amphora = new Amphora({ internal: { issuer: ISSUER }, logger });

    aegis = new Aegis({ amphora, logger });

    await amphora.setup();

    amphora.add(TEST_EC_KEY_SIG);

    ({ token } = await aegis.mint("access_token", {
      audience: [AUDIENCE],
      clientId: "client-1",
      expires: "1h",
      subject: "user-1",
    }));
  });

  afterEach(() => MockDate.set(MINTED_AT));

  const cases: Array<[string, Date, DomainAssert, AssertOptions]> = [
    ["live token, no options", MINTED_AT, { audience: AUDIENCE }, {}],
    ["live token, wrong audience", MINTED_AT, { audience: "https://other.test/" }, {}],
    ["expired by 10s, no tolerance", EXPIRED_BY_TEN_SECONDS, { audience: AUDIENCE }, {}],
    [
      "expired by 10s, 60s tolerance",
      EXPIRED_BY_TEN_SECONDS,
      { audience: AUDIENCE },
      { clockTolerance: 60 },
    ],
    [
      "expired by 10s, 5s tolerance",
      EXPIRED_BY_TEN_SECONDS,
      { audience: AUDIENCE },
      { clockTolerance: 5 },
    ],
    [
      "long expired, expiration check off",
      LONG_EXPIRED,
      { audience: AUDIENCE },
      { verifyExpiration: false },
    ],
    [
      "long expired, currentDate rewound",
      LONG_EXPIRED,
      { audience: AUDIENCE },
      {
        currentDate: MINTED_AT,
      },
    ],
    [
      "fresh token, maxTokenAge satisfied",
      new Date("2024-01-01T08:05:00.000Z"),
      { audience: AUDIENCE },
      { maxTokenAge: 600 },
    ],
    [
      "stale token, maxTokenAge exceeded",
      new Date("2024-01-01T08:30:00.000Z"),
      { audience: AUDIENCE },
      { maxTokenAge: 600 },
    ],
  ];

  test.each(cases)("should agree on %s", async (_name, clock, assert, options) => {
    // Claims are read at MINT time, when the token is unquestionably valid — the
    // comparison is about the CHECK, not about being able to read the token.
    const verified = await aegis.verify(token);

    MockDate.set(clock);

    let verifyThrew = false;
    try {
      await aegis.verify(token, assert, options);
    } catch {
      verifyThrew = true;
    }

    const assertPassed = Aegis.matches(verified.claims as Dict, assert, options);

    expect(assertPassed).toBe(!verifyThrew);
  });
});
