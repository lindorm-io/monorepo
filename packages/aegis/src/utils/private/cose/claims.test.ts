import { Dict } from "@lindorm/types";
import { decodeCoseClaims, mapCoseClaims } from "./claims";

describe("mapCoseClaims", () => {
  let claims: Dict;

  beforeEach(() => {
    claims = {
      aud: ["audience"],
      exp: 1234567890,
      iat: 1234567890,
      iss: "issuer",
      jti: "29569bc5-64a1-5bb6-9c2a-bd17814702aa",
      nbf: 1234567890,
      sub: "cd7eacb1-a3a4-5943-bffc-d163f1949a5d",

      acr: "acr",
      amr: ["amr1", "amr2"],
      at_hash: "at_hash",
      auth_time: 1234567890,
      azp: "azp",
      c_hash: "c_hash",
      nonce: "nonce",
      s_hash: "s_hash",

      aal: 3,
      afr: "afr1",
      cid: "4f325774-db23-5eb5-9a1f-60a82ca42c2b",
      gty: "grant_type",
      loa: 2,
      per: ["permission1", "permission2"],
      rls: ["role1", "role2"],
      scope: ["scope1", "scope2"],
      sid: "60991f15-6ddf-5e0c-8b95-bebf3bca9724",
      sih: "session_hint",
      suh: "subject_hint",
      tid: "097a9cf0-b70c-58ce-b97e-b7359daacc17",
      token_type: "token_type",
    };
  });

  test("should map COSE claims", () => {
    expect(mapCoseClaims(claims as any)).toMatchSnapshot();
  });

  test("should decode mapped COSE claims", () => {
    expect(decodeCoseClaims(mapCoseClaims(claims as any))).toEqual(claims);
  });

  describe("custom numeric claim labels", () => {
    test("should encode numeric key 900 as integer label in internal mode", () => {
      const result = mapCoseClaims({ 900: "user-abc" } as any);
      expect(result.get(900)).toBe("user-abc");
      expect(result.has("900")).toBe(false);
    });

    test("should encode numeric key 900 as string key in external mode", () => {
      const result = mapCoseClaims({ 900: "user-abc" } as any, "external");
      expect(result.get("900")).toBe("user-abc");
      expect(result.has(900)).toBe(false);
    });

    test("should throw for numeric key below 900", () => {
      expect(() => mapCoseClaims({ 899: "val" } as any)).toThrow(
        "Custom COSE claim label must be >= 900, got 899",
      );
    });

    test("should throw for numeric key 1 (IANA range)", () => {
      expect(() => mapCoseClaims({ 1: "val" } as any)).toThrow(
        "Custom COSE claim label must be >= 900, got 1",
      );
    });

    test("should throw for numeric key 500 (Lindorm range)", () => {
      expect(() => mapCoseClaims({ 500: "val" } as any)).toThrow(
        "Custom COSE claim label must be >= 900, got 500",
      );
    });

    test("should not affect non-numeric string keys", () => {
      const result = mapCoseClaims({ customClaim: "hello" } as any);
      expect(result.get("customClaim")).toBe("hello");
    });

    test("should round-trip custom claims through encode and decode", () => {
      const input = { 900: "user-abc", 901: 42 } as any;
      const encoded = mapCoseClaims(input);
      const decoded = decodeCoseClaims(encoded);
      expect(decoded["900"]).toBe("user-abc");
      expect(decoded["901"]).toBe(42);
    });

    test("should handle large labels correctly", () => {
      const result = mapCoseClaims({ 10000: "large" } as any);
      expect(result.get(10000)).toBe("large");
    });
  });
});
