import type { Dict } from "@lindorm/types";
import type { ValidateJwtOptions } from "../types/index.js";
import { Aegis } from "./Aegis.js";
import { describe, expect, test } from "vitest";

// The array-valued claims the registry knows AND the domain matcher surface
// names. A SCALAR matcher against one of them means "the claim must CONTAIN this
// value" — the form `useAccess({ audience })` uses, which the assert path used to
// refuse because it built `$eq` and an array never equals a string.
const ARRAY_CLAIMS = [
  "audience",
  "scope",
  "authMethods",
  "roles",
  "permissions",
  "groups",
  "entitlements",
] as const;

const claims = (key: string, value: unknown): Dict => ({ [key]: value });
const matchers = (key: string, value: unknown): ValidateJwtOptions =>
  ({ [key]: value }) as ValidateJwtOptions;

describe("Aegis.assert / Aegis.matches", () => {
  // The four reported repro cases, verbatim.
  describe("reported cases", () => {
    test("should accept a scalar audience against an array aud", () => {
      expect(() =>
        Aegis.assert(
          { audience: ["https://tyr.test"] },
          { audience: "https://tyr.test" },
        ),
      ).not.toThrow();
    });

    // `audience` is scalar-by-design on the matcher surface ("contains this ONE
    // identity"), so an ARRAY audience matcher is reachable only untyped — the
    // runtime accepts it as a plain $all. The cast records that gap; it is not a
    // form the typed surface offers.
    test("should accept an array audience against an array aud", () => {
      expect(() =>
        Aegis.assert({ audience: ["https://tyr.test"] }, {
          audience: ["https://tyr.test"],
        } as unknown as ValidateJwtOptions),
      ).not.toThrow();
    });

    test("should accept a scalar scope against an array scope", () => {
      expect(() =>
        Aegis.assert({ scope: ["openid"] }, { scope: "openid" }),
      ).not.toThrow();
    });

    test("should accept an equal subject", () => {
      expect(() => Aegis.assert({ subject: "s" }, { subject: "s" })).not.toThrow();
    });
  });

  describe("scalar matcher against an array-valued claim", () => {
    test.each(ARRAY_CLAIMS)("should accept a scalar %s matcher", (key) => {
      expect(() =>
        Aegis.assert(claims(key, ["a-value"]), matchers(key, "a-value")),
      ).not.toThrow();
      expect(Aegis.matches(claims(key, ["a-value"]), matchers(key, "a-value"))).toBe(
        true,
      );
    });

    test.each(ARRAY_CLAIMS)("should reject a scalar %s the claim lacks", (key) => {
      expect(() =>
        Aegis.assert(claims(key, ["other"]), matchers(key, "a-value")),
      ).toThrow();
      expect(Aegis.matches(claims(key, ["other"]), matchers(key, "a-value"))).toBe(false);
    });

    test("should accept a scalar audience against a multi-valued aud", () => {
      expect(
        Aegis.matches(
          { audience: ["https://tyr.test", "https://other.test"] },
          { audience: "https://tyr.test" },
        ),
      ).toBe(true);
    });
  });

  describe("array matcher against an array-valued claim", () => {
    test.each(ARRAY_CLAIMS)("should accept an array %s matcher", (key) => {
      expect(
        Aegis.matches(claims(key, ["one", "two"]), matchers(key, ["one", "two"])),
      ).toBe(true);
    });

    test("should require ALL listed values", () => {
      expect(Aegis.matches({ scope: ["openid"] }, { scope: ["openid", "profile"] })).toBe(
        false,
      );
      expect(
        Aegis.matches({ scope: ["openid", "profile"] }, { scope: ["openid", "profile"] }),
      ).toBe(true);
    });
  });

  describe("operator matcher", () => {
    test("should match any of an $in set", () => {
      expect(
        Aegis.matches({ roles: ["editor"] }, { roles: { $in: ["admin", "editor"] } }),
      ).toBe(true);
      expect(
        Aegis.matches({ roles: ["viewer"] }, { roles: { $in: ["admin", "editor"] } }),
      ).toBe(false);
    });

    test("should honour a comparison operator on a folded claim", () => {
      expect(
        Aegis.matches({ levelOfAssurance: 3 }, { levelOfAssurance: { $gte: 2 } }),
      ).toBe(true);
      expect(
        Aegis.matches({ levelOfAssurance: 1 }, { levelOfAssurance: { $gte: 2 } }),
      ).toBe(false);
    });
  });

  describe("scalar equality claims", () => {
    test("should match an equal subject", () => {
      expect(Aegis.matches({ subject: "s" }, { subject: "s" })).toBe(true);
      expect(Aegis.matches({ subject: "s" }, { subject: "other" })).toBe(false);
    });

    test("should match an equal issuer", () => {
      expect(
        Aegis.matches({ issuer: "https://idp.test" }, { issuer: "https://idp.test" }),
      ).toBe(true);
      expect(
        Aegis.matches({ issuer: "https://idp.test" }, { issuer: "https://other.test" }),
      ).toBe(false);
    });
  });

  describe("assert is the throwing layer over matches", () => {
    test("should report every failing key", () => {
      try {
        Aegis.assert(
          { audience: ["https://other.test"], subject: "s" },
          { audience: "https://tyr.test", subject: "other" },
        );
        throw new Error("expected assert to throw");
      } catch (err: any) {
        expect(err.code).toBe("jwt_claims_invalid");
        expect(err.data.invalid).toEqual(["audience", "subject"]);
      }
    });

    test("should agree with matches on every case", () => {
      const cases: Array<[Dict, ValidateJwtOptions]> = [
        [{ audience: ["https://tyr.test"] }, { audience: "https://tyr.test" }],
        [
          { audience: ["https://tyr.test"] },
          { audience: ["https://tyr.test"] } as unknown as ValidateJwtOptions,
        ],
        [{ scope: ["openid"] }, { scope: "openid" }],
        [{ scope: ["openid"] }, { scope: "profile" }],
        [{ subject: "s" }, { subject: "s" }],
        [{ subject: "s" }, { subject: "other" }],
      ];

      for (const [dict, matcher] of cases) {
        let threw = false;
        try {
          Aegis.assert(dict, matcher);
        } catch {
          threw = true;
        }
        expect(Aegis.matches(dict, matcher)).toBe(!threw);
      }
    });
  });
});
