import { B64 } from "@lindorm/b64";
import { isString } from "@lindorm/is";
import { B64U } from "../constants/format.js";
import { hashAlgorithmOf, parseCoseCertHash } from "./cose-hash-algorithms.js";

/**
 * The `COSE_CertHash` codec — the COSE form of a certificate thumbprint.
 * RFC 9360 §2.
 *
 * ⭐ COSE'S ONE PARAMETER MEETS JOSE'S TWO: JOSE names the digest algorithm in the
 * PARAMETER (RFC 7515 §4.1.7, RFC 7515 §4.1.8), COSE in the VALUE. So:
 *
 *   - WRITE emits exactly one label 34, always SHA-256. A CBOR map cannot carry a
 *     duplicate key, so both digests can never ride one COSE token — which is why
 *     `certificateThumbprintSha1` is `absent` on the COSE side of the registry.
 *   - READ dispatches on `hashAlg`, so ONE wire label reaches TWO domain fields.
 *
 * The algorithm TABLE and the structural PARSE live in `cose-hash-algorithms.ts`,
 * shared with `cose-wide-cert-binding.ts`.
 */

/**
 * The COSE algorithm label a SHA-256 thumbprint is written under (RFC 9054 §3.2),
 * read OFF THE SHARED TABLE: a second literal is a second place the write and the
 * read can disagree about what SHA-256 is.
 */
const SHA_256_LABEL = hashAlgorithmOf("SHA-256")!.label;

/**
 * JOSE `x5t#S256` -> `COSE_CertHash`, stated under the SHA-256 label because the
 * parameter this encodes IS the SHA-256 digest (RFC 7515 §4.1.8). A non-string
 * value is returned untouched.
 */
export const encodeCoseCertHash = (value: unknown): unknown =>
  isString(value) ? [SHA_256_LABEL, B64.toBuffer(value, B64U)] : value;

/**
 * `COSE_CertHash` -> the JOSE thumbprint parameter it belongs to, digest
 * base64url-encoded.
 *
 * `undefined` where the structure is not a conformant `COSE_CertHash`, where
 * `hashAlg` names an algorithm the table does not carry, or where the algorithm
 * has no `jose` cell — those are answered by `cose-wide-cert-binding.ts`.
 *
 * ⚠ The dispatch is what keeps `cert_binding_thumbprint_mismatch` honest: landing
 * label 34 on `x5t#S256` without reading `hashAlg` compares a foreign SHA-1 digest
 * against aegis's SHA-256 one and blames the CERTIFICATE for what is an ALGORITHM
 * difference. Pinned in `cose-cert-hash.test.ts`.
 */
export const decodeCoseCertHash = (
  value: unknown,
): { jose: "x5t#S256" | "x5t"; value: string } | undefined => {
  const parsed = parseCoseCertHash(value);

  if (parsed?.algorithm.jose === undefined) return undefined;

  return { jose: parsed.algorithm.jose, value: B64.encode(parsed.digest, B64U) };
};
