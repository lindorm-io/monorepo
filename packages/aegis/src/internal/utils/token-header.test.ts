import { DecodedTokenHeader } from "../../types";
import { parseTokenHeader } from "./token-header";

describe("parseTokenHeader", () => {
  describe("critical parameter handling", () => {
    test("should preserve known critical parameters", () => {
      const decoded: DecodedTokenHeader = {
        alg: "ES512",
        typ: "JWS",
        crit: ["alg", "typ", "kid"],
        kid: "test-key-id",
      };

      const parsed = parseTokenHeader(decoded);

      expect(parsed.critical).toEqual(["algorithm", "headerType", "keyId"]);
    });

    test("should preserve unknown critical parameters", () => {
      const decoded: DecodedTokenHeader = {
        alg: "ES512",
        typ: "JWS",
        crit: ["unknownParam", "anotherUnknown"],
        kid: "test-key-id",
      };

      const parsed = parseTokenHeader(decoded);

      // Unknown params should be passed through as-is for Kit class rejection
      expect(parsed.critical).toEqual(["anotherUnknown", "unknownParam"]);
    });

    test("should preserve mixed known and unknown critical parameters", () => {
      const decoded: DecodedTokenHeader = {
        alg: "ES512",
        typ: "JWS",
        crit: ["alg", "unknownParam", "kid"],
        kid: "test-key-id",
      };

      const parsed = parseTokenHeader(decoded);

      // Should contain both mapped known params and pass-through unknown params
      expect(parsed.critical).toEqual(["algorithm", "keyId", "unknownParam"]);
    });

    test("should handle empty critical array", () => {
      const decoded: DecodedTokenHeader = {
        alg: "ES512",
        typ: "JWS",
        crit: [],
        kid: "test-key-id",
      };

      const parsed = parseTokenHeader(decoded);

      expect(parsed.critical).toEqual([]);
    });

    test("should handle missing critical field", () => {
      const decoded: DecodedTokenHeader = {
        alg: "ES512",
        typ: "JWS",
        kid: "test-key-id",
      };

      const parsed = parseTokenHeader(decoded);

      expect(parsed.critical).toEqual([]);
    });

    test("should sort critical parameters alphabetically", () => {
      const decoded: DecodedTokenHeader = {
        alg: "ES512",
        typ: "JWS",
        crit: ["zulu", "alpha", "bravo"],
        kid: "test-key-id",
      };

      const parsed = parseTokenHeader(decoded);

      expect(parsed.critical).toEqual(["alpha", "bravo", "zulu"]);
    });
  });
});
