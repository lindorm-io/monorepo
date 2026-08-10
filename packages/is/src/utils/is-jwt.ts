import { parseTokenClaims, parseTokenHeader } from "../internal/index.js";
import { isJws } from "./is-jws.js";
import { isString } from "./is-string.js";

/**
 * The media types that declare a signed but OPAQUE payload: RFC 7515 §9.2.1's
 * registered `JOSE` short name, the bare `JWS` form, and the `+jws` structured
 * suffix. A producer stamping one of these has said the payload is not a claims
 * set — which is the shape of an authorization server's opaque access-token
 * handle, and it must never read as a JWT even when the handle happens to be
 * serialised as JSON.
 */
const isOpaqueTokenType = (typ: unknown): boolean =>
  isString(typ) && (typ === "JWS" || typ === "JOSE" || typ.endsWith("+jws"));

/**
 * Is this a JWT — a JWS whose payload is a JWT Claims Set (RFC 7519 §3)?
 *
 * `typ` is a HINT, never the discriminant. RFC 7519 §5.1 makes it OPTIONAL and
 * most id_tokens omit it, while RFC 9068 (`at+jwt`), RFC 9449 (`dpop+jwt`) and
 * RFC 8417 (`secevent+jwt`) each stamp their own, so no fixed value can decide
 * the question. What decides it is RFC 7519 §7.2 step 10: the payload must
 * decode to "a completely valid JSON object". That is the only evidence
 * available without a key, and it is what separates a JWT from a bare JWS.
 *
 * The two available pieces of evidence must AGREE — neither overrides the other:
 *
 * - The payload IS a JSON object. A detached, opaque, or non-object payload is
 *   not a claims set, so a token DECLARING `typ: JWT` over one is not a JWT
 *   either; an envelope that misdescribes its content is not trusted.
 * - The header does NOT declare an opaque type. A signed handle whose payload
 *   happens to be a JSON object is still opaque, and its producer said so.
 *
 * NOT accepted: a JWT encoded as a JWE (RFC 7519 §3's "and/or JWE") — its claims
 * are ciphertext, unreadable here; use `isJwe`. Nor a Nested JWT (RFC 7519 §5.2),
 * whose payload is an inner compact token rather than a claims object; that is a
 * `isJws` true / `isJwt` false, and unwrapping it needs the decryption key.
 */
export const isJwt = (input: any): input is string => {
  if (!isJws(input)) return false;
  if (isOpaqueTokenType(parseTokenHeader(input)?.typ)) return false;

  return parseTokenClaims(input) !== null;
};
