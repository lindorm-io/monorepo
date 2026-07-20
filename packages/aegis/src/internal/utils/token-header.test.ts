import type {
  DecodedTokenHeader,
  TokenHeaderClaims,
  TokenHeaderOptions,
} from "../../types/index.js";
import { mapTokenHeader, parseTokenHeader } from "./token-header.js";
import { describe, expect, test } from "vitest";

describe("data-driven header codec", () => {
  test("the full RFC set (x5t/x5u/zip/apu/apv) round-trips map -> parse", () => {
    const options: TokenHeaderOptions = {
      algorithm: "ES512",
      headerType: "JWS",
      keyId: "test-key-id",
      certificateThumbprintSha1: "cert-sha1-thumbprint",
      certificateUrl: "https://example.com/certs",
      zip: "DEF",
      partyProducer: "party-u-info",
      partyRecipient: "party-v-info",
    };

    const raw = mapTokenHeader(options) as TokenHeaderClaims;

    expect(raw.x5t).toBe("cert-sha1-thumbprint");
    expect(raw.x5u).toBe("https://example.com/certs");
    expect(raw.zip).toBe("DEF");
    expect(raw.apu).toBe("party-u-info");
    expect(raw.apv).toBe("party-v-info");

    const parsed = parseTokenHeader(raw as DecodedTokenHeader);

    expect(parsed.certificateThumbprintSha1).toBe("cert-sha1-thumbprint");
    expect(parsed.certificateUrl).toBe("https://example.com/certs");
    expect(parsed.zip).toBe("DEF");
    expect(parsed.partyProducer).toBe("party-u-info");
    expect(parsed.partyRecipient).toBe("party-v-info");
  });

  test("emitted JSON keys are jose-alphabetical (canonical, byte-order-load-bearing)", () => {
    // The source is deliberately NOT in jose order; the encoder must re-sort so the
    // signed-header bytes stay canonical regardless of caller insertion order.
    const options: TokenHeaderOptions = {
      zip: "DEF",
      keyId: "test-key-id",
      algorithm: "ES512",
      partyRecipient: "v",
      partyProducer: "u",
      headerType: "JWS",
      contentType: "example",
    };

    const raw = mapTokenHeader(options);

    expect(Object.keys(raw)).toEqual(["alg", "apu", "apv", "cty", "kid", "typ", "zip"]);
  });

  test("an unregistered domain key is dropped on write (headers are a closed set)", () => {
    const options = {
      algorithm: "ES512",
      headerType: "JWS",
      keyId: "test-key-id",
      notAHeader: "should-be-dropped",
    } as TokenHeaderOptions;

    const raw = mapTokenHeader(options) as Record<string, unknown>;

    expect(raw.notAHeader).toBeUndefined();
    expect("notAHeader" in raw).toBe(false);
  });

  test("an unregistered wire key is dropped on read", () => {
    const decoded = {
      alg: "ES512",
      typ: "JWS",
      kid: "test-key-id",
      not_a_header: "should-be-dropped",
    } as unknown as DecodedTokenHeader;

    const parsed = parseTokenHeader(decoded) as Record<string, unknown>;

    expect(parsed.not_a_header).toBeUndefined();
    expect(parsed.notAHeader).toBeUndefined();
  });
});

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
