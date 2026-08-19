import { B64 } from "@lindorm/b64";
import { isString } from "@lindorm/is";
import { B64U } from "../constants/format.js";
import { hashAlgorithmOf, parseCoseCertHash } from "./cose-hash-algorithms.js";

/**
 * RFC 9360 §2 `COSE_CertHash` — the value type of `x5t` (label 34), the COSE form
 * of a certificate thumbprint.
 *
 * The CDDL, verbatim from RFC 9360 §2:
 *
 *     COSE_CertHash = [ hashAlg: (int / tstr), hashValue: bstr ]
 *
 * and §2 fixes what each element is: *"The first element is an algorithm
 * identifier that is an integer or a string containing the hash algorithm
 * identifier corresponding to the Value column (integer or text string) of the
 * algorithm registered in the "COSE Algorithms" registry […] The second element
 * is a binary string containing the hash value computed over the DER-encoded
 * certificate."*
 *
 * ⭐ THIS IS WHERE COSE'S ONE PARAMETER MEETS JOSE'S TWO. JOSE names the digest
 * algorithm in the PARAMETER (RFC 7515 §4.1.7 `x5t` is SHA-1, §4.1.8 `x5t#S256`
 * is SHA-256); COSE names it in the VALUE. So:
 *
 *   - WRITE emits exactly one label 34, always SHA-256. A CBOR map cannot carry a
 *     duplicate key, so both digests can never ride one COSE token — which is why
 *     `certificateThumbprintSha1` is `absent` on the COSE side of the registry.
 *   - READ dispatches on `hashAlg` and answers with the JOSE parameter the value
 *     belongs to, which is how ONE wire label reaches TWO domain fields.
 *
 * The algorithm TABLE and the structural PARSE of that CDDL both live in
 * `cose-hash-algorithms.ts`, shared with `cose-wide-cert-binding.ts` — the second
 * consumer, which answers for the digests JOSE has no parameter for.
 */

/**
 * The COSE algorithm label a SHA-256 thumbprint is written under (RFC 9054 §3.2),
 * READ OFF THE SHARED TABLE rather than restated: a second literal beside it is a
 * second place the write and the read can disagree about what SHA-256 is.
 */
const SHA_256_LABEL = hashAlgorithmOf("SHA-256")!.label;

/**
 * JOSE `x5t#S256` -> `COSE_CertHash`. The base64url digest becomes the `bstr`
 * `hashValue` and the algorithm is stated as the SHA-256 label, because the
 * parameter this encodes IS the SHA-256 digest (RFC 7515 §4.1.8). A non-string
 * value is returned untouched.
 */
export const encodeCoseCertHash = (value: unknown): unknown =>
  isString(value) ? [SHA_256_LABEL, B64.toBuffer(value, B64U)] : value;

/**
 * `COSE_CertHash` -> the JOSE thumbprint parameter it belongs to, with the digest
 * base64url-encoded (the representation a decoded JOSE header carries).
 *
 * `undefined` where the structure is not a conformant `COSE_CertHash`, where its
 * `hashAlg` names an algorithm the table does not carry, or where the algorithm
 * has no `jose` cell — SHA-384 and SHA-512 are implemented and have no JOSE
 * parameter, so they leave the wire header and are answered by
 * `cose-wide-cert-binding.ts` instead.
 *
 * ⚠ THE DISPATCH IS WHAT KEEPS `cert_binding_thumbprint_mismatch` HONEST. Landing
 * label 34 on `x5t#S256` without reading `hashAlg` would compare a foreign SHA-1
 * digest against aegis's SHA-256 one and refuse the token for a mismatched
 * CERTIFICATE, when the truth is a different ALGORITHM — pinned in
 * `cose-cert-hash.test.ts`.
 */
export const decodeCoseCertHash = (
  value: unknown,
): { jose: "x5t#S256" | "x5t"; value: string } | undefined => {
  const parsed = parseCoseCertHash(value);

  if (parsed?.algorithm.jose === undefined) return undefined;

  return { jose: parsed.algorithm.jose, value: B64.encode(parsed.digest, B64U) };
};
