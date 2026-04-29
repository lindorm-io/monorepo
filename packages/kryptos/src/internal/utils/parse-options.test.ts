import { parseJwkOptions } from "./parse-options.js";
import { describe, expect, test } from "vitest";

describe("parseJwkOptions", () => {
  const baseJwk = {
    kid: "abc",
    alg: "ES256",
    kty: "EC",
    use: "sig",
  } as any;

  test("reads x5t#S256 with literal # from raw input", () => {
    const jwk = {
      ...baseJwk,
      x5c: ["MIIB"],
      "x5t#S256": "thumbprintvalue",
    };

    const result = parseJwkOptions(jwk);

    expect(result.certificateChain).toEqual(["MIIB"]);
  });

  test("accepts canonical key_ops (RFC 7517)", () => {
    const jwk = { ...baseJwk, key_ops: ["sign", "verify"] };

    const result = parseJwkOptions(jwk);

    expect(result.operations).toEqual(["sign", "verify"]);
  });

  test("accepts camelCase keyOps as fallback", () => {
    const jwk = { ...baseJwk, keyOps: ["sign"] };

    const result = parseJwkOptions(jwk);

    expect(result.operations).toEqual(["sign"]);
  });

  test("accepts canonical owner_id", () => {
    const jwk = { ...baseJwk, owner_id: "user-123" };

    const result = parseJwkOptions(jwk);

    expect(result.ownerId).toBe("user-123");
  });

  test("accepts camelCase ownerId as fallback", () => {
    const jwk = { ...baseJwk, ownerId: "user-456" };

    const result = parseJwkOptions(jwk);

    expect(result.ownerId).toBe("user-456");
  });

  test("prefers snake_case when both forms are present", () => {
    const jwk = { ...baseJwk, key_ops: ["sign"], keyOps: ["verify"] };

    const result = parseJwkOptions(jwk);

    expect(result.operations).toEqual(["sign"]);
  });
});
