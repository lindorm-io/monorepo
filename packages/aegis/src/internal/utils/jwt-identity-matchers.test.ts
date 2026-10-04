import { refusalOf } from "../../__fixtures__/refusal-of.js";
import { AegisDomainError } from "../../errors/index.js";
import { createHash } from "./create-hash.js";
import { HASH_MATCHERS } from "./hash-matchers.js";
import { createIdentityMatchers } from "./jwt-identity-matchers.js";
import { joseName } from "../claims/claims-registry.js";
import { describe, expect, test } from "vitest";

const SOURCES = Object.keys(HASH_MATCHERS);

const NON_STRINGS: Array<[string, unknown]> = [
  ["$eq", { $eq: "the-raw-source" }],
  ["$in", { $in: ["the-raw-source"] }],
  ["$regex", { $regex: "^the-" }],
  ["number", 42],
  ["array", ["x"]],
  ["null", null],
  ["boolean", true],
  ["Date", new Date("2026-01-01T00:00:00.000Z")],
];

const thrownBy = (bag: Record<string, unknown>): AegisDomainError => {
  try {
    createIdentityMatchers("ES256", bag, joseName);
  } catch (error) {
    if (error instanceof AegisDomainError) return error;
    throw error;
  }

  throw new Error("expected a refusal");
};

describe("createIdentityMatchers", () => {
  describe("refusal identity", () => {
    test.each([
      ["a key that maps to no claim", { nope: "x" }],
      ["a raw hash source given a non-string", { accessToken: { $eq: "x" } }],
      ["a claim given a value no operator is lifted from", { subject: null }],
    ])("should refuse %s under the wire-neutral code, title and type", (_label, bag) => {
      const { code, title, type, message } = thrownBy(bag);

      expect({ code, title, type, message }).toMatchSnapshot();
    });

    test("should describe an unmapped key without naming a token format", () => {
      expect(thrownBy({ nope: "x" }).details).toBe(
        "A verify option key does not map to any known claim, so no predicate can be built for it.",
      );
    });
  });

  describe("hash-derive matchers refuse a non-string source", () => {
    test.each(
      SOURCES.flatMap((source) =>
        NON_STRINGS.map(([label, value]) => [source, label, value] as const),
      ),
    )("should refuse %s given a %s", (source, _label, value) => {
      const error = thrownBy({ [source]: value });

      expect(error.code).toBe("claim_matcher_unsupported_value");
      expect(error.data).toEqual({ key: source });
      expect(error.details).toBe(
        "A verify option value for a raw hash source must be a string; this key was given an unsupported type.",
      );
    });

    test("should keep the raw source out of the refusal message", () => {
      expect(thrownBy({ accessToken: ["the-raw-token"] }).message).not.toContain(
        "the-raw-token",
      );
    });

    test("should refuse the non-string source before a digest claim written after it", () => {
      const error = thrownBy({ accessToken: { $eq: "x" }, accessTokenHash: "y" });

      expect(error.code).toBe("claim_matcher_unsupported_value");
      expect(error.data).toEqual({ key: "accessToken" });
    });

    test("should report the collision when the digest claim is written before the non-string source", () => {
      const error = thrownBy({ accessTokenHash: "y", accessToken: { $eq: "x" } });

      expect(error.code).toBe("claim_matcher_conflict");
      expect(error.data).toStrictEqual({ keys: ["accessTokenHash", "accessToken"] });
      expect(error.debug).toStrictEqual({ claim: "at_hash" });
    });
  });

  // A collision is two keys resolving to one wire name in ONE condition object:
  // that is the object whose indexed writes would displace each other. Two
  // `$or` branches are two objects, each checked on its own.
  describe("collision scope", () => {
    test("should build the same wire name stated once in each of two $or branches", () => {
      expect(
        createIdentityMatchers(
          "ES256",
          { $or: [{ accessToken: "raw" }, { accessTokenHash: "digest" }] },
          joseName,
        ),
      ).toEqual({
        $or: [{ at_hash: { $eq: expect.any(String) } }, { at_hash: { $eq: "digest" } }],
      });
    });

    test("should refuse the same wire name stated twice inside one $or branch", () => {
      const error = thrownBy({
        $or: [{ accessToken: "raw", accessTokenHash: "digest" }],
      });

      expect(error.code).toBe("claim_matcher_conflict");
      expect(error.data).toStrictEqual({ keys: ["accessToken", "accessTokenHash"] });
      expect(error.debug).toStrictEqual({ claim: "at_hash" });
    });

    test("should name the caller's two keys in the refusal message, never the wire claim", () => {
      expect(
        refusalOf(() =>
          createIdentityMatchers(
            "ES256",
            { $or: [{ accessToken: "raw", accessTokenHash: "digest" }] },
            joseName,
          ),
        ),
      ).toMatchSnapshot();
    });

    test("should refuse an unmapped key inside a branch under its own name", () => {
      const error = thrownBy({ $and: [{ subject: "s" }, { nope: "x" }] });

      expect(error.code).toBe("claim_matcher_unsupported_key");
      expect(error.data).toEqual({ key: "nope" });
    });

    test("should hash a raw source inside a branch", () => {
      expect(
        createIdentityMatchers("ES256", { $not: { accessToken: "raw" } }, joseName),
      ).toEqual({ $not: { at_hash: { $eq: createHash("ES256", "raw") } } });
    });
  });
});
