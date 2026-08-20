import { B64 } from "@lindorm/b64";
import { isArray, isString } from "@lindorm/is";

/**
 * RFC 9360 §2 `COSE_X509` — the value type of `x5chain` (label 33), the COSE form
 * of JOSE's `x5c`.
 *
 * The `COSE_X509` CDDL, verbatim from RFC 9360 §2 (the sibling `COSE_CertHash`
 * production between the two lines is elided):
 *
 *     COSE_X509 = bstr / [ 2*certs: bstr ]
 *
 *     The contents of "bstr" are the bytes of a DER-encoded certificate.
 *
 * and §2's prose fixes which arm applies, in two adjacent bullets: *"If a single
 * certificate is conveyed, it is placed in a CBOR byte string. […] If multiple
 * certificates are conveyed, a CBOR array of byte strings is used, with each
 * certificate being in its own byte string."* — so a ONE-member array is not a conformant `COSE_X509`; `2*certs`
 * requires two.
 *
 * JOSE spells the same chain as `Array<base64>` (RFC 7515 §4.1.6 — standard
 * base64, NOT base64url), which is the vocabulary the header registry and the
 * domain header speak on both wires. These two functions are the crossing.
 */

/**
 * JOSE `x5c` -> `COSE_X509`. A single certificate becomes the bare `bstr`; two or
 * more become the array. A value that is not an array of base64 strings is
 * returned untouched, so the caller's own guard reports it rather than this codec
 * inventing a verdict.
 *
 * ⚠ An EMPTY chain has no `COSE_X509` form at all — neither arm admits zero
 * members — so it is returned untouched too. Nothing reaches here with one:
 * `x5c` prunes when empty (`header-registry.ts`) and `resolveCertBinding` never
 * emits an empty chain.
 */
export const encodeCoseX509 = (value: unknown): unknown => {
  if (!isArray(value)) return value;
  if (!value.every(isString)) return value;
  if (value.length === 0) return value;

  const certs = value.map((cert): Buffer => B64.toBuffer(cert));

  return certs.length === 1 ? certs[0] : certs;
};

/**
 * `COSE_X509` -> JOSE `x5c`. Both arms normalise to an array and each DER byte
 * string is standard-base64 encoded — the exact representation a decoded JOSE
 * header carries. A value that is neither a byte string nor an array of byte
 * strings is returned untouched.
 */
export const decodeCoseX509 = (value: unknown): unknown => {
  const members = isArray(value) ? value : [value];

  if (!members.every((member) => member instanceof Uint8Array)) return value;

  return members.map((cert): string => B64.encode(cert));
};
