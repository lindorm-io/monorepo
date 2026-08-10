import { Amphora } from "@lindorm/amphora";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import type { Dict } from "@lindorm/types";
import MockDate from "mockdate";
import { TEST_EC_KEY_SIG } from "../__fixtures__/keys.js";
import type { DomainAssert } from "../types/index.js";
import { Aegis } from "./Aegis.js";
import { beforeEach, describe, expect, test } from "vitest";

// The signing fixture has a fixed validity window — the round-trip block below
// mints and verifies, so the clock must sit inside it.
MockDate.set(new Date("2024-01-01T08:00:00.000Z"));

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
const matchers = (key: string, value: unknown): DomainAssert =>
  ({ [key]: value }) as DomainAssert;

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
        } as unknown as DomainAssert),
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
      const cases: Array<[Dict, DomainAssert]> = [
        [{ audience: ["https://tyr.test"] }, { audience: "https://tyr.test" }],
        [
          { audience: ["https://tyr.test"] },
          { audience: ["https://tyr.test"] } as unknown as DomainAssert,
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

  // Mint hashes a RAW source into a domain claim; `assert` matches that claim
  // by name. It does NOT derive the digest itself — hashing is tied to the
  // token's signing `alg` (OIDC Core §3.1.3.6), `alg` is a HEADER parameter,
  // and this surface is handed a flat claim dict with no header to read one
  // from. `verify` holds a key, so it derives; `assert` matches what mint wrote.
  describe("mint → assert round trip", () => {
    const issuer = "https://test.lindorm.io/";

    const sources = {
      accessToken: "12ceb9251ddf52399fe62f122a45844865a83dcb52585fea90ae3448e024",
      authCode: "999a8b01e27c56aeb5b2f47c001ef8be7be39a375f8c5e929f82df1626de01d8",
      authState: "7409ac52a9615b8c9f9a",
    };

    let aegis: Aegis;

    beforeEach(async () => {
      const logger = createMockLogger();
      const amphora = new Amphora({ internal: { issuer }, logger });

      aegis = new Aegis({ amphora, logger });

      await amphora.setup();

      amphora.add(TEST_EC_KEY_SIG);
    });

    const mint = () =>
      aegis.mint("default", {
        expires: "1h",
        subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
        tokenType: "test_token",
        ...sources,
      });

    const mintVerified = async () => {
      const { token } = await mint();

      return aegis.verify(token);
    };

    const HASH_CLAIMS = {
      accessToken: "accessTokenHash",
      authCode: "codeHash",
      authState: "stateHash",
    } as const;

    // Mint writes the digest under its domain claim name; assert matches it as
    // an ordinary equality claim. No `algorithm`, no derivation.
    test.each(Object.values(HASH_CLAIMS))(
      "should assert a minted token by its %s claim",
      async (claim) => {
        const verified = await mintVerified();
        const digest = (verified.claims as Dict)[claim];

        expect(digest).toEqual(expect.any(String));

        expect(() =>
          Aegis.assert(verified.claims as Dict, { [claim]: digest }),
        ).not.toThrow();

        expect(
          Aegis.matches(verified.claims as Dict, { [claim]: "a-different-digest" }),
        ).toBe(false);
      },
    );

    test("should assert all three hash claims at once", async () => {
      const verified = await mintVerified();
      const claims = verified.claims as Dict;

      expect(
        Aegis.matches(claims, {
          accessTokenHash: claims.accessTokenHash,
          codeHash: claims.codeHash,
          stateHash: claims.stateHash,
        }),
      ).toBe(true);
    });

    // The division this surface exists to make: a RAW source is verify's
    // matcher — it needs the signing algorithm, which only the key-holding
    // surface has. `verify` accepts it; `assert` has no such matcher, and a key
    // cast past the type is an unmapped one that matches nothing.
    test.each(["accessToken", "authCode", "authState"] as const)(
      "should derive %s on verify while assert does not",
      async (key) => {
        const { token } = await mint();

        await expect(aegis.verify(token, { [key]: sources[key] })).resolves.toBeDefined();

        const verified = await aegis.verify(token);

        expect(
          Aegis.matches(verified.claims as Dict, { [key]: sources[key] } as never),
        ).toBe(false);
      },
    );
  });
});
