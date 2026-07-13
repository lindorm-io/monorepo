import type { ShaAlgorithm } from "@lindorm/types";
import type { BinaryToTextEncoding } from "crypto";
import { ShaError } from "../errors/index.js";
import { assertShaHash, createShaHash, verifyShaHash } from "./sha-hash.js";
import { describe, expect, test } from "vitest";

const ALGORITHMS: Array<ShaAlgorithm> = ["SHA1", "SHA256", "SHA384", "SHA512"];
const ENCODINGS: Array<BinaryToTextEncoding> = ["base64", "base64url", "hex", "binary"];

describe("sha-hash", () => {
  describe("create", () => {
    describe.each(ALGORITHMS)("%s", (algorithm) => {
      test.each(["base64", "base64url", "hex"] as Array<BinaryToTextEncoding>)(
        "should create hash at %s digest",
        (encoding) => {
          expect(createShaHash({ algorithm, data: "data", encoding })).toMatchSnapshot();
        },
      );

      test("should create hash from Buffer data", () => {
        expect(createShaHash({ algorithm, data: Buffer.from("data", "utf8") })).toEqual(
          createShaHash({ algorithm, data: "data" }),
        );
      });
    });
  });

  describe("SHA256", () => {
    test("should create hash at base64 digest", () => {
      expect(
        createShaHash({ algorithm: "SHA256", data: "data", encoding: "base64" }),
      ).toEqual("Om6weQ85rIfJTzhWst0sXREOaBFgImGpqSPTuyOtyLc=");
    });

    test("should create hash at hex digest", () => {
      expect(
        createShaHash({ algorithm: "SHA256", data: "data", encoding: "hex" }),
      ).toEqual("3a6eb0790f39ac87c94f3856b2dd2c5d110e6811602261a9a923d3bb23adc8b7");
    });
  });

  describe("SHA384", () => {
    test("should create hash at base64 digest", () => {
      expect(
        createShaHash({ algorithm: "SHA384", data: "data", encoding: "base64" }),
      ).toEqual("IDng8LknKEmfuI4j68PP0FVLKEALDte3UwVciLWGXDwqpyxqGprgp1XYeQCkpv9B");
    });

    test("should create hash at hex digest", () => {
      expect(
        createShaHash({ algorithm: "SHA384", data: "data", encoding: "hex" }),
      ).toEqual(
        "2039e0f0b92728499fb88e23ebc3cfd0554b28400b0ed7b753055c88b5865c3c2aa72c6a1a9ae0a755d87900a4a6ff41",
      );
    });
  });

  describe("SHA512", () => {
    test("should create hash at base64 digest", () => {
      expect(
        createShaHash({ algorithm: "SHA512", data: "data", encoding: "base64" }),
      ).toEqual(
        "d8fOml2GuzhtRDu5Y5D6oSBjMVhpnIhEwwsTqwv5J2C35EFq6jl9uRtKwOXdVrjvfksGYWKrH9wIgxnObe/Idg==",
      );
    });

    test("should create hash at hex digest", () => {
      expect(
        createShaHash({ algorithm: "SHA512", data: "data", encoding: "hex" }),
      ).toEqual(
        "77c7ce9a5d86bb386d443bb96390faa120633158699c8844c30b13ab0bf92760b7e4416aea397db91b4ac0e5dd56b8ef7e4b066162ab1fdc088319ce6defc876",
      );
    });
  });

  describe("verify", () => {
    test("should verify hash", () => {
      expect(
        verifyShaHash({
          data: "data",
          hash: "Om6weQ85rIfJTzhWst0sXREOaBFgImGpqSPTuyOtyLc=",
        }),
      ).toEqual(true);
    });

    describe.each(ALGORITHMS)("%s", (algorithm) => {
      describe.each(ENCODINGS)("%s", (encoding) => {
        test("should verify a correct hash", () => {
          expect(
            verifyShaHash({
              algorithm,
              data: "data",
              encoding,
              hash: createShaHash({ algorithm, data: "data", encoding }),
            }),
          ).toEqual(true);
        });

        test("should verify a correct hash of Buffer data", () => {
          expect(
            verifyShaHash({
              algorithm,
              data: Buffer.from("data", "utf8"),
              encoding,
              hash: createShaHash({ algorithm, data: "data", encoding }),
            }),
          ).toEqual(true);
        });

        test("should reject a wrong hash of equal length", () => {
          expect(
            verifyShaHash({
              algorithm,
              data: "data",
              encoding,
              hash: createShaHash({ algorithm, data: "other", encoding }),
            }),
          ).toEqual(false);
        });

        test("should reject a hash of another algorithm without throwing", () => {
          const other = algorithm === "SHA512" ? "SHA256" : "SHA512";

          expect(() =>
            verifyShaHash({
              algorithm,
              data: "data",
              encoding,
              hash: createShaHash({ algorithm: other, data: "data", encoding }),
            }),
          ).not.toThrow();

          expect(
            verifyShaHash({
              algorithm,
              data: "data",
              encoding,
              hash: createShaHash({ algorithm: other, data: "data", encoding }),
            }),
          ).toEqual(false);
        });

        test("should reject a truncated hash without throwing", () => {
          const hash = createShaHash({ algorithm, data: "data", encoding }).slice(0, 8);

          expect(() =>
            verifyShaHash({ algorithm, data: "data", encoding, hash }),
          ).not.toThrow();

          expect(verifyShaHash({ algorithm, data: "data", encoding, hash })).toEqual(
            false,
          );
        });

        test("should reject an overlong hash without throwing", () => {
          const hash =
            createShaHash({ algorithm, data: "data", encoding }) +
            createShaHash({ algorithm, data: "data", encoding });

          expect(() =>
            verifyShaHash({ algorithm, data: "data", encoding, hash }),
          ).not.toThrow();

          expect(verifyShaHash({ algorithm, data: "data", encoding, hash })).toEqual(
            false,
          );
        });

        test("should reject an empty hash without throwing", () => {
          expect(() =>
            verifyShaHash({ algorithm, data: "data", encoding, hash: "" }),
          ).not.toThrow();

          expect(verifyShaHash({ algorithm, data: "data", encoding, hash: "" })).toEqual(
            false,
          );
        });

        test("should reject a garbage hash without throwing", () => {
          const hash = "!! not a digest !!";

          expect(() =>
            verifyShaHash({ algorithm, data: "data", encoding, hash }),
          ).not.toThrow();

          expect(verifyShaHash({ algorithm, data: "data", encoding, hash })).toEqual(
            false,
          );
        });
      });
    });

    test("should reject a correct base64 hash with trailing characters", () => {
      // Buffer.from stops decoding at the base64 padding - the trailing junk must not
      // slip through on the decoded bytes alone
      expect(
        verifyShaHash({
          data: "data",
          hash: `${createShaHash({ data: "data" })}junk`,
        }),
      ).toEqual(false);
    });

    test("should reject a hash encoded with a different encoding than configured", () => {
      // SHA512 of "data" contains base64 chars that base64url replaces (+ /)
      expect(
        verifyShaHash({
          algorithm: "SHA512",
          data: "data",
          encoding: "base64",
          hash: createShaHash({ algorithm: "SHA512", data: "data", encoding: "hex" }),
        }),
      ).toEqual(false);
    });
  });

  describe("assert", () => {
    test("should assert hash", () => {
      expect(() =>
        assertShaHash({
          data: "data",
          hash: "Om6weQ85rIfJTzhWst0sXREOaBFgImGpqSPTuyOtyLc=",
        }),
      ).not.toThrow();
    });

    test("should throw error on invalid hash", () => {
      expect(() =>
        assertShaHash({
          data: "invalid",
          hash: "Om6weQ85rIfJTzhWst0sXREOaBFgImGpqSPTuyOtyLc=",
        }),
      ).toThrow(ShaError);
    });

    test("should throw error with hash_mismatch code", () => {
      try {
        assertShaHash({ data: "invalid", hash: createShaHash({ data: "data" }) });
        throw new Error("expected assertShaHash to throw");
      } catch (error: any) {
        expect(error).toBeInstanceOf(ShaError);
        expect(error.code).toEqual("hash_mismatch");
        expect(error.title).toEqual("Hash Mismatch");
        expect(error.message).toMatchSnapshot();
        expect(error.details).toMatchSnapshot();
      }
    });

    test("should throw error on hash of unequal length", () => {
      expect(() => assertShaHash({ data: "data", hash: "too-short" })).toThrow(ShaError);
    });

    test("should throw error on empty hash", () => {
      expect(() => assertShaHash({ data: "data", hash: "" })).toThrow(ShaError);
    });

    test("should return void on match", () => {
      expect(
        assertShaHash({ data: "data", hash: createShaHash({ data: "data" }) }),
      ).toBeUndefined();
    });
  });
});
