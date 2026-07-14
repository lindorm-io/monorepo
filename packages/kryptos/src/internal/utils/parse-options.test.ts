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

  // `operations` is derived from the key material (see `Kryptos.operations`), so
  // an incoming key_ops is dropped on the floor — never read, never a throw. A
  // remote party's odd key_ops is not our failure.
  test("ignores key_ops entirely", () => {
    const jwk = { ...baseJwk, key_ops: ["verify"], keyOps: ["sign"] };

    const result = parseJwkOptions(jwk);

    expect(result).not.toHaveProperty("operations");
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

  test("prefers snake_case owner_id when both forms are present", () => {
    const jwk = { ...baseJwk, owner_id: "user-123", ownerId: "user-456" };

    const result = parseJwkOptions(jwk);

    expect(result.ownerId).toBe("user-123");
  });
});
