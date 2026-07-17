import { SPEC_BY_KEY } from "./envelope-field-table.js";
import { decodeScalarFromJson } from "./scalar-json-codec.js";
import { describe, expect, it } from "vitest";

describe("scalar-json-codec", () => {
  describe("decodeScalarFromJson", () => {
    it("passes typed values through", () => {
      expect(decodeScalarFromJson(SPEC_BY_KEY.topic, "orders")).toBe("orders");
      expect(decodeScalarFromJson(SPEC_BY_KEY.attempt, 3)).toBe(3);
      expect(decodeScalarFromJson(SPEC_BY_KEY.retryMultiplier, 2.5)).toBe(2.5);
      expect(decodeScalarFromJson(SPEC_BY_KEY.broadcast, true)).toBe(true);
    });

    it("applies defaults when the value is missing", () => {
      expect(decodeScalarFromJson(SPEC_BY_KEY.topic, undefined)).toBe("");
      expect(decodeScalarFromJson(SPEC_BY_KEY.retryDelay, undefined)).toBe(1000);
      expect(decodeScalarFromJson(SPEC_BY_KEY.retryStrategy, undefined)).toBe("constant");
    });

    it("coerces bool strictly from `true`", () => {
      expect(decodeScalarFromJson(SPEC_BY_KEY.broadcast, false)).toBe(false);
      expect(decodeScalarFromJson(SPEC_BY_KEY.broadcast, undefined)).toBe(false);
      expect(decodeScalarFromJson(SPEC_BY_KEY.broadcast, "true")).toBe(false);
    });

    it("preserves nullable-int including zero", () => {
      expect(decodeScalarFromJson(SPEC_BY_KEY.expiry, null)).toBeNull();
      expect(decodeScalarFromJson(SPEC_BY_KEY.expiry, undefined)).toBeNull();
      expect(decodeScalarFromJson(SPEC_BY_KEY.expiry, 0)).toBe(0);
      expect(decodeScalarFromJson(SPEC_BY_KEY.expiry, 30000)).toBe(30000);
    });

    it("maps empty/absent nullable-string to null", () => {
      expect(decodeScalarFromJson(SPEC_BY_KEY.replyTo, null)).toBeNull();
      expect(decodeScalarFromJson(SPEC_BY_KEY.replyTo, "")).toBeNull();
      expect(decodeScalarFromJson(SPEC_BY_KEY.correlationId, "corr")).toBe("corr");
    });
  });
});
