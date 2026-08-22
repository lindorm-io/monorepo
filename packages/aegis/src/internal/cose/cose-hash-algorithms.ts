import { isArray, isNumber, isString } from "@lindorm/is";
import type { ShaAlgorithm } from "@lindorm/types";

/**
 * WHICH HASH ALGORITHMS AEGIS ANSWERS FOR IN A `COSE_CertHash`, and the ONE
 * structural parse of that CDDL. RFC 9360 §2.
 *
 * ⚠ Its own module because it has two consumers that must not drift:
 * `cose-cert-hash.ts` (the codec) and `cose-wide-cert-binding.ts` (which
 * RECOMPUTES a digest JOSE has no parameter for). Both the TABLE and the PARSE
 * are shared — a second copy of either is a second answer to one question.
 */

/**
 * Labels from RFC 9054 §3.1 (SHA-1) and RFC 9054 §3.2 (the SHA-2 family).
 *
 * ⚠ `jose` IS OPTIONAL, and that is the whole asymmetry: RFC 7515 §4.1.7 and
 * RFC 7515 §4.1.8 register two thumbprint parameters, so a SHA-384 or SHA-512 digest has nowhere
 * in the domain header to travel and is COMPARED on the COSE read path instead.
 *
 * ⚠ SHA-512/256 (`-17`) is absent because `ShaAlgorithm` (`@lindorm/types`) has
 * no method to compute it — a truncated SHA-512 variant, not SHA-512 chopped by
 * hand. Dropped rather than approximated.
 *
 * ⚠ SHA-1 is here for the READ direction only; aegis never writes one.
 */
export const HASH_ALGORITHM: ReadonlyArray<{
  label: number;
  name: string;
  /** The JOSE thumbprint parameter this digest belongs in, where JOSE has one. */
  jose?: "x5t#S256" | "x5t";
  /** The `ShaKit` algorithm that recomputes it from a leaf certificate's DER. */
  sha: ShaAlgorithm;
}> = [
  { label: -16, name: "SHA-256", jose: "x5t#S256", sha: "SHA256" },
  { label: -14, name: "SHA-1", jose: "x5t", sha: "SHA1" },
  { label: -43, name: "SHA-384", sha: "SHA384" },
  { label: -44, name: "SHA-512", sha: "SHA512" },
];

export type HashAlgorithm = (typeof HASH_ALGORITHM)[number];

/**
 * The table row a `hashAlg` names, in EITHER spelling — RFC 9360 §2. Refusing a
 * conformant binding because its `hashAlg` was spelled as text would write aegis's
 * limitation onto the wire.
 */
export const hashAlgorithmOf = (hashAlg: unknown): HashAlgorithm | undefined => {
  if (isNumber(hashAlg)) return HASH_ALGORITHM.find((alg) => alg.label === hashAlg);
  if (isString(hashAlg)) return HASH_ALGORITHM.find((alg) => alg.name === hashAlg);

  return undefined;
};

/**
 * THE ONE STRUCTURAL PARSE of RFC 9360 §2's `COSE_CertHash`, read by both
 * consumers. `undefined` where the value is not a conformant two-element
 * `[ hashAlg, hashValue ]` with a byte-string digest, or where `hashAlg` names an
 * algorithm this table does not carry.
 *
 * ⚠ A second copy of this shape is the hazard: tightening one — a stricter digest
 * length, a rejected tagged value — leaves the other accepting what the first
 * refuses, on the same bytes.
 */
export const parseCoseCertHash = (
  value: unknown,
): { algorithm: HashAlgorithm; digest: Uint8Array } | undefined => {
  if (!isArray(value) || value.length !== 2) return undefined;

  const [hashAlg, digest] = value as ReadonlyArray<unknown>;

  if (!(digest instanceof Uint8Array)) return undefined;

  const algorithm = hashAlgorithmOf(hashAlg);
  if (algorithm === undefined) return undefined;

  return { algorithm, digest };
};
