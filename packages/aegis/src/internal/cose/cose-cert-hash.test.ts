import { B64 } from "@lindorm/b64";
import { describe, expect, test } from "vitest";
import { decodeCoseCertHash, encodeCoseCertHash } from "./cose-cert-hash.js";

const DIGEST = Buffer.alloc(32, 7);
const DIGEST_B64U = B64.encode(DIGEST, "base64url");

const SHA1_DIGEST = Buffer.alloc(20, 3);
const SHA1_B64U = B64.encode(SHA1_DIGEST, "base64url");

/**
 * RFC 9360 §2 `COSE_CertHash = [ hashAlg: (int / tstr), hashValue: bstr ]`, with
 * the algorithm identifiers from RFC 9054 — SHA-256 is `-16` (§3.2 table) and
 * SHA-1 is `-14` (Table 1).
 */
describe("encodeCoseCertHash", () => {
  test("writes the SHA-256 label beside the decoded digest bytes", () => {
    expect(encodeCoseCertHash(DIGEST_B64U)).toEqual([-16, DIGEST]);
  });

  // The parameter this encodes IS the SHA-256 digest (RFC 7515 §4.1.8), so the
  // algorithm is a constant here rather than something read off the value.
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
   * ⭐ THE FAN-OUT: one wire label, two domain parameters, chosen by `hashAlg`.
   * RFC 9360 §2 admits BOTH spellings — *"an algorithm identifier that is an
   * integer or a string containing the hash algorithm identifier corresponding to
   * the Value column (integer or text string) of the algorithm registered in the
   * "COSE Algorithms" registry"* — so a conformant producer that spells SHA-256
   * as text names the same algorithm as `-16`.
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
   * ⚠ THIS IS WHAT KEEPS `cert_binding_thumbprint_mismatch` HONEST. A SHA-1
   * COSE_CertHash landed on `x5t#S256` without reading `hashAlg` would be compared
   * against the verifying key's SHA-256 digest and refuse the token for a
   * mismatched CERTIFICATE, when the truth is a different ALGORITHM.
   */
  test("a SHA-1 hash never lands on the SHA-256 parameter", () => {
    expect(decodeCoseCertHash([-14, SHA1_DIGEST])).toMatchObject({ jose: "x5t" });
  });

  /**
   * An algorithm aegis has no JOSE parameter for is DROPPED. RFC 9360 §2 permits
   * any registered hash, and the domain header has the two parameters JOSE gives
   * it (RFC 7515 §4.1.7/§4.1.8) — so there is no field such a binding could be
   * reported in. SHA-512 is `-44` (RFC 9054 §3.2).
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
