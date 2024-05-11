import { ShaError } from "../../errors";
import { _assertShaHash, _createShaHash, _verifyShaHash } from "./sha-hash";

describe("sha-hash", () => {
  describe("SHA256", () => {
    test("should create hash at base64 digest", () => {
      expect(_createShaHash({ algorithm: "SHA256", data: "data", format: "base64" })).toBe(
        "Om6weQ85rIfJTzhWst0sXREOaBFgImGpqSPTuyOtyLc=",
      );
    });

    test("should create hash at hex digest", () => {
      expect(_createShaHash({ algorithm: "SHA256", data: "data", format: "hex" })).toBe(
        "3a6eb0790f39ac87c94f3856b2dd2c5d110e6811602261a9a923d3bb23adc8b7",
      );
    });
  });

  describe("SHA384", () => {
    test("should create hash at base64 digest", () => {
      expect(_createShaHash({ algorithm: "SHA384", data: "data", format: "base64" })).toBe(
        "IDng8LknKEmfuI4j68PP0FVLKEALDte3UwVciLWGXDwqpyxqGprgp1XYeQCkpv9B",
      );
    });

    test("should create hash at hex digest", () => {
      expect(_createShaHash({ algorithm: "SHA384", data: "data", format: "hex" })).toBe(
        "2039e0f0b92728499fb88e23ebc3cfd0554b28400b0ed7b753055c88b5865c3c2aa72c6a1a9ae0a755d87900a4a6ff41",
      );
    });
  });

  describe("SHA512", () => {
    test("should create hash at base64 digest", () => {
      expect(_createShaHash({ algorithm: "SHA512", data: "data", format: "base64" })).toBe(
        "d8fOml2GuzhtRDu5Y5D6oSBjMVhpnIhEwwsTqwv5J2C35EFq6jl9uRtKwOXdVrjvfksGYWKrH9wIgxnObe/Idg==",
      );
    });

    test("should create hash at hex digest", () => {
      expect(_createShaHash({ algorithm: "SHA512", data: "data", format: "hex" })).toBe(
        "77c7ce9a5d86bb386d443bb96390faa120633158699c8844c30b13ab0bf92760b7e4416aea397db91b4ac0e5dd56b8ef7e4b066162ab1fdc088319ce6defc876",
      );
    });
  });

  describe("verify", () => {
    test("should verify hash", () => {
      expect(
        _verifyShaHash({
          data: "data",
          hash: "Om6weQ85rIfJTzhWst0sXREOaBFgImGpqSPTuyOtyLc=",
        }),
      ).toBe(true);
    });
  });

  describe("assert", () => {
    test("should assert hash", () => {
      expect(() =>
        _assertShaHash({
          data: "data",
          hash: "Om6weQ85rIfJTzhWst0sXREOaBFgImGpqSPTuyOtyLc=",
        }),
      ).not.toThrow();
    });

    test("should throw error on invalid hash", () => {
      expect(() =>
        _assertShaHash({
          data: "invalid",
          hash: "Om6weQ85rIfJTzhWst0sXREOaBFgImGpqSPTuyOtyLc=",
        }),
      ).toThrow(ShaError);
    });
  });
});
