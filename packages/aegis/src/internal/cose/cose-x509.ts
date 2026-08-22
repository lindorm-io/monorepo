import { B64 } from "@lindorm/b64";
import { isArray, isString } from "@lindorm/is";

/**
 * The `COSE_X509` codec — the COSE form of JOSE's `x5c`. RFC 9360 §2.
 *
 * ⚠ A ONE-member array is not a conformant `COSE_X509`: a single certificate is
 * the bare `bstr`, and the array arm requires two.
 *
 * ⚠ JOSE spells the same chain as `Array<base64>` — standard base64, NOT
 * base64url (RFC 7515 §4.1.6) — which is the vocabulary the header registry and
 * the domain header speak on both wires. These two functions are the crossing.
 */

/**
 * JOSE `x5c` -> `COSE_X509`. A value that is not an array of base64 strings is
 * returned untouched, so the caller's own guard reports it rather than this codec
 * inventing a verdict.
 *
 * ⚠ An EMPTY chain has no `COSE_X509` form — neither arm admits zero members — so
 * it too is returned untouched. Nothing reaches here with one: `x5c` prunes when
 * empty (`header-registry.ts`) and `resolveCertBinding` never emits one.
 */
export const encodeCoseX509 = (value: unknown): unknown => {
  if (!isArray(value)) return value;
  if (!value.every(isString)) return value;
  if (value.length === 0) return value;

  const certs = value.map((cert): Buffer => B64.toBuffer(cert));

  return certs.length === 1 ? certs[0] : certs;
};

/**
 * `COSE_X509` -> JOSE `x5c`. Both arms normalise to an array, each DER byte string
 * standard-base64 encoded. A value that is neither a byte string nor an array of
 * byte strings is returned untouched.
 */
export const decodeCoseX509 = (value: unknown): unknown => {
  const members = isArray(value) ? value : [value];

  if (!members.every((member) => member instanceof Uint8Array)) return value;

  return members.map((cert): string => B64.encode(cert));
};
