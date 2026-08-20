import { isArray, isNumber, isString } from "@lindorm/is";
import type { ShaAlgorithm } from "@lindorm/types";

/**
 * WHICH HASH ALGORITHMS AEGIS ANSWERS FOR IN A `COSE_CertHash`, and the ONE
 * structural parse of that CDDL.
 *
 * RFC 9360 §2 defines `COSE_CertHash = [ hashAlg: (int / tstr), hashValue: bstr ]`
 * — the digest algorithm is a member of the VALUE rather than part of a parameter
 * name, which is the whole reason COSE's one `x5t` (label 34) has to reach two
 * JOSE parameters and, beyond them, a computed comparison.
 *
 * It sits in its own module because it has two consumers that must not drift:
 * `cose-cert-hash.ts` (the codec, which routes a digest into the JOSE parameter it
 * belongs in) and `cose-wide-cert-binding.ts` (which RECOMPUTES a digest JOSE has
 * no parameter for). Both the TABLE and the PARSE are shared — a second copy of
 * either is a second answer to one question.
 */

/**
 * Values verbatim from RFC 9054: Table 1 gives `|SHA-1|-14 | SHA-1 Hash |`, and
 * the §3.2 table gives `|SHA-256    |-16  |SHA-2      |`,
 * `|SHA-384    |-43  |SHA-2      |` and `|SHA-512    |-44  |SHA-2      |`.
 *
 * ⚠ `jose` IS OPTIONAL, AND THAT IS THE WHOLE ASYMMETRY. RFC 7517 §4.8/§4.9
 * register exactly two thumbprint parameters, so only SHA-1 and SHA-256 have a
 * JOSE spelling and therefore a domain header field. SHA-384 and SHA-512 are
 * `Recommended: Yes` in RFC 9054 — a conformant issuer may bind with either — but
 * a digest under one has nowhere in the domain header to travel, which is why it
 * is COMPARED on the COSE read path instead of carried.
 *
 * ⚠ SHA-512/256 (`-17`) IS ABSENT, and deliberately: it is a distinct truncated
 * variant of SHA-512, not SHA-512 chopped by hand, and `ShaAlgorithm`
 * (`@lindorm/types`) is `"SHA1" | "SHA256" | "SHA384" | "SHA512"` — there is no
 * method to compute it with. It stays dropped rather than approximated.
 *
 * ⚠ SHA-1 is here for the READ direction only. RFC 9054 §3.1 marks it
 * "Filter Only" — *"there are still times where SHA-1 needs to be used […] the
 * SHA-1 value is used for the purpose of filtering"* — and aegis never writes one
 * on this wire.
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
 * The table row a `hashAlg` names, in EITHER spelling RFC 9360 §2 admits — the
 * integer from the COSE Algorithms registry and the registry NAME. Refusing a
 * conformant binding merely because its `hashAlg` was spelled as text would be
 * aegis's limitation written onto the wire.
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
 * ⚠ A SECOND COPY OF THIS SHAPE IS THE HAZARD. Each consumer previously asked
 * `isArray` → `length === 2` → `instanceof Uint8Array` for itself, so tightening
 * one — a stricter digest length, a rejected tagged value — would leave the other
 * accepting what the first refuses, on the same bytes.
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
