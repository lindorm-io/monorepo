import { describe, expect, test } from "vitest";
import {
  HASH_ALGORITHM,
  hashAlgorithmOf,
  parseCoseCertHash,
} from "./cose-hash-algorithms.js";

/**
 * THE SHARED TABLE AND THE SHARED PARSE — the contract two consumers depend on
 * (`cose-cert-hash.ts`'s codec and `cose-wide-cert-binding.ts`'s comparison), which
 * is why it is pinned here rather than only through each of them.
 */
describe("HASH_ALGORITHM", () => {
  /**
   * ⚠ AGAINST LITERALS, deliberately. Reading the labels back out of the table the
   * production code reads would make this agree with any table ever written. The
   * values are RFC 9054's: Table 1 for SHA-1, the §3.2 table for the SHA-2 family.
   */
  test("carries exactly the four algorithms aegis can compute", () => {
    expect(
      HASH_ALGORITHM.map(({ label, name, jose, sha }) => ({ label, name, jose, sha })),
    ).toStrictEqual([
      { label: -16, name: "SHA-256", jose: "x5t#S256", sha: "SHA256" },
      { label: -14, name: "SHA-1", jose: "x5t", sha: "SHA1" },
      { label: -43, name: "SHA-384", jose: undefined, sha: "SHA384" },
      { label: -44, name: "SHA-512", jose: undefined, sha: "SHA512" },
    ]);
  });

  /**
   * ⭐ THE ASYMMETRY THE WHOLE BUILD RESTS ON: exactly the two algorithms JOSE
   * registers a parameter for (RFC 7517 §4.8/§4.9) carry a `jose` cell. A third
   * would mean a digest could ride the domain header under a parameter whose name
   * names a different algorithm.
   */
  test("gives a jose parameter to exactly the two JOSE registers", () => {
    expect(
      HASH_ALGORITHM.filter((alg) => alg.jose !== undefined).map((alg) => alg.jose),
    ).toStrictEqual(["x5t#S256", "x5t"]);
  });
});

describe("hashAlgorithmOf", () => {
  // RFC 9360 §2 admits `hashAlg: (int / tstr)`, so both spellings name the same row.
  test.each([
    [-16, "SHA-256"],
    ["SHA-256", "SHA-256"],
    [-44, "SHA-512"],
    ["SHA-512", "SHA-512"],
  ])("resolves %s", (hashAlg, name) => {
    expect(hashAlgorithmOf(hashAlg)?.name).toBe(name);
  });

  test.each([
    ["SHA-512/256, which has no ShaKit method", -17],
    ["an unregistered label", -999],
    ["a name aegis does not carry", "SHA3-256"],
    ["a non-label value", { label: -16 }],
  ])("declines %s", (_what, hashAlg) => {
    expect(hashAlgorithmOf(hashAlg)).toBeUndefined();
  });
});

describe("parseCoseCertHash", () => {
  const DIGEST = Buffer.alloc(32, 7);

  test("parses a conformant COSE_CertHash to its row and its bytes", () => {
    expect(parseCoseCertHash([-16, DIGEST])).toStrictEqual({
      algorithm: HASH_ALGORITHM[0],
      digest: DIGEST,
    });
  });

  /**
   * ⚠ ONE PARSE, TWO CONSUMERS. Each used to ask `isArray` → `length === 2` →
   * `instanceof Uint8Array` for itself, so tightening one — a stricter digest
   * length, a rejected tagged value — would leave the other accepting on the same
   * bytes what the first refuses.
   */
  test.each([
    ["a non-array", "MIIBsample"],
    ["a one-element array", [-16]],
    ["a three-element array", [-16, Buffer.alloc(32), Buffer.alloc(32)]],
    ["a non-bstr hash value", [-16, "not-bytes"]],
    ["an algorithm the table does not carry", [-17, Buffer.alloc(32)]],
  ])("declines %s", (_what, value) => {
    expect(parseCoseCertHash(value)).toBeUndefined();
  });
});
