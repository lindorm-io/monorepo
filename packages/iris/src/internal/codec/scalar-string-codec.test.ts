import { SPEC_BY_KEY } from "./envelope-field-table.js";
import { decodeScalarFromString, encodeScalarToString } from "./scalar-string-codec.js";
import { describe, expect, it } from "vitest";

describe("scalar-string-codec", () => {
  describe("encodeScalarToString", () => {
    it("encodes string fields", () => {
      expect(encodeScalarToString(SPEC_BY_KEY.topic, "orders")).toBe("orders");
      expect(encodeScalarToString(SPEC_BY_KEY.retryStrategy, "exponential")).toBe(
        "exponential",
      );
    });

    it("encodes int/float/bool as their string form", () => {
      expect(encodeScalarToString(SPEC_BY_KEY.attempt, 3)).toBe("3");
      expect(encodeScalarToString(SPEC_BY_KEY.retryMultiplier, 2.5)).toBe("2.5");
      expect(encodeScalarToString(SPEC_BY_KEY.broadcast, true)).toBe("true");
      expect(encodeScalarToString(SPEC_BY_KEY.retryJitter, false)).toBe("false");
    });

    it("encodes nullable-int: null → empty string, number → string", () => {
      expect(encodeScalarToString(SPEC_BY_KEY.expiry, null)).toBe("");
      expect(encodeScalarToString(SPEC_BY_KEY.expiry, 0)).toBe("0");
      expect(encodeScalarToString(SPEC_BY_KEY.expiry, 30000)).toBe("30000");
    });

    it("encodes nullable-string: null → empty string", () => {
      expect(encodeScalarToString(SPEC_BY_KEY.replyTo, null)).toBe("");
      expect(encodeScalarToString(SPEC_BY_KEY.correlationId, "corr")).toBe("corr");
    });
  });

  describe("decodeScalarFromString", () => {
    it("returns the declared default when the wire value is absent", () => {
      expect(decodeScalarFromString(SPEC_BY_KEY.retryDelay, undefined)).toBe(1000);
      expect(decodeScalarFromString(SPEC_BY_KEY.retryStrategy, undefined)).toBe(
        "constant",
      );
      expect(decodeScalarFromString(SPEC_BY_KEY.expiry, undefined)).toBeNull();
      expect(decodeScalarFromString(SPEC_BY_KEY.broadcast, undefined)).toBe(false);
    });

    it("decodes int/float/bool", () => {
      expect(decodeScalarFromString(SPEC_BY_KEY.attempt, "7")).toBe(7);
      expect(decodeScalarFromString(SPEC_BY_KEY.retryMultiplier, "3.5")).toBe(3.5);
      expect(decodeScalarFromString(SPEC_BY_KEY.broadcast, "true")).toBe(true);
      expect(decodeScalarFromString(SPEC_BY_KEY.broadcast, "false")).toBe(false);
    });

    it("decodes nullable-int: empty string → null, else number", () => {
      expect(decodeScalarFromString(SPEC_BY_KEY.expiry, "")).toBeNull();
      expect(decodeScalarFromString(SPEC_BY_KEY.expiry, "0")).toBe(0);
      expect(decodeScalarFromString(SPEC_BY_KEY.expiry, "30000")).toBe(30000);
    });

    it("decodes nullable-string: empty string → null", () => {
      expect(decodeScalarFromString(SPEC_BY_KEY.replyTo, "")).toBeNull();
      expect(decodeScalarFromString(SPEC_BY_KEY.replyTo, "reply-q")).toBe("reply-q");
    });
  });
});
