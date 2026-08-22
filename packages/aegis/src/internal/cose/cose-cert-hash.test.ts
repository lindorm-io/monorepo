import { B64 } from "@lindorm/b64";
import { describe, expect, test } from "vitest";
import { decodeCoseCertHash, encodeCoseCertHash } from "./cose-cert-hash.js";

const DIGEST = Buffer.alloc(32, 7);
const DIGEST_B64U = B64.encode(DIGEST, "base64url");

const SHA1_DIGEST = Buffer.alloc(20, 3);
const SHA1_B64U = B64.encode(SHA1_DIGEST, "base64url");

/**
 * The `COSE_CertHash` codec. RFC 9360 §2, with the algorithm identifiers from
 * RFC 9054 §3.1 (SHA-1) and RFC 9054 §3.2 (SHA-2).
 */
describe("encodeCoseCertHash", () => {
  test("writes the SHA-256 label beside the decoded digest bytes", () => {
    expect(encodeCoseCertHash(DIGEST_B64U)).toEqual([-16, DIGEST]);
  });

  // The parameter this encodes IS the SHA-256 digest (RFC 7515 §4.1.8), so the
  // algorithm is a constant rather than something read off the value.
  test("never writes any other algorithm", () => {
    const [algorithm] = encodeCoseCertHash(SHA1_B64U) as Array<unknown>;
    expect(algorithm).toBe(-16);
  });

  test("leaves a non-string value untouched", () => {
    expect(encodeCoseCertHash(42)).toBe(42);
  });
});

describe("decodeCoseCertHash", () => {
  /**
   * THE FAN-OUT: one wire label, two domain parameters, chosen by `hashAlg`.
   * Both the integer and the text spelling. RFC 9360 §2.
   */
  test.each([
    [-16, "x5t#S256", DIGEST, DIGEST_B64U],
    ["SHA-256", "x5t#S256", DIGEST, DIGEST_B64U],
    [-14, "x5t", SHA1_DIGEST, SHA1_B64U],
    ["SHA-1", "x5t", SHA1_DIGEST, SHA1_B64U],
  ])("dispatches hashAlg %s onto %s", (hashAlg, jose, bytes, encoded) => {
    expect(decodeCoseCertHash([hashAlg, bytes])).toEqual({ jose, value: encoded });
  });

  /**
   * ⚠ What keeps `cert_binding_thumbprint_mismatch` honest: a SHA-1 COSE_CertHash
   * landed on `x5t#S256` without reading `hashAlg` is compared against the key's
   * SHA-256 digest and blames the CERTIFICATE for an ALGORITHM difference.
   */
  test("a SHA-1 hash never lands on the SHA-256 parameter", () => {
    expect(decodeCoseCertHash([-14, SHA1_DIGEST])).toMatchObject({ jose: "x5t" });
  });

  /**
   * An algorithm JOSE has no parameter for is DROPPED: the domain header carries
   * only RFC 7515 §4.1.7 and RFC 7515 §4.1.8, so there is no field to report such
   * a binding in. RFC 9360 §2.
   */
  test("drops a hash algorithm with no JOSE parameter", () => {
    expect(decodeCoseCertHash([-44, Buffer.alloc(64, 1)])).toBeUndefined();
  });

  test.each([
    ["not an array", "nonsense"],
    ["a one-element array", [-16]],
    ["a three-element array", [-16, DIGEST, DIGEST]],
    ["a non-bstr hash value", [-16, DIGEST_B64U]],
  ])("drops %s", (_what, value) => {
    expect(decodeCoseCertHash(value)).toBeUndefined();
  });
});

describe("round trip", () => {
  test("a SHA-256 digest survives encode then decode", () => {
    expect(decodeCoseCertHash(encodeCoseCertHash(DIGEST_B64U))).toEqual({
      jose: "x5t#S256",
      value: DIGEST_B64U,
    });
  });
});
