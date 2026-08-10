import { JweKit } from "../classes/JweKit.js";
import { JwtKit } from "../classes/JwtKit.js";
import { coseCty, isCwe, isCwm, isCwt } from "../internal/cose/is-cose-format.js";
import { isClaimsContentType } from "../internal/utils/is-claims-content-type.js";
import { decodeJoseHeader } from "../internal/utils/jose-header.js";

/** The JOSE `cty` off a compact token's protected header. Never throws. */
const joseCty = (token: string): string | undefined => {
  try {
    return decodeJoseHeader(token.split(".")[0]).cty;
  } catch {
    return undefined;
  }
};

/**
 * Is this token one whose CLAIMS aegis can establish locally — the question a
 * resource server actually has to answer before it decides between verifying a
 * credential itself and introspecting it (RFC 7662)?
 *
 * TRUE for the claims-bearing formats and for a sign-then-encrypt wrapper around
 * one:
 *
 * - STRUCTURED — a `jwt`, `cwt`, or `cwm`. The claims layer is right there.
 * - ENCRYPTED with a DECLARED claims payload — a `jwe`/`cwe` whose `cty` names a
 *   nested JWT/CWT/CWM (RFC 7519 §5.2 / RFC 8392). The ciphertext is unreadable
 *   here, but the declaration is on the cleartext protected header, and it is the
 *   same declaration the read side reconstructs the plaintext by — so a token
 *   this accepts is one `verify` decrypts and re-verifies to real claims.
 *
 * FALSE for an UNSTRUCTURED `jws`/`cws` — a signature over an OPAQUE payload with
 * no claims layer, which is exactly the shape of an authorization server's opaque
 * access-token HANDLE. `verify` will happily process one and hand back its `raw`
 * bytes beside an EMPTY domain; that is a correct result for `aegis.jws.verify`
 * and a catastrophic one for an authorization decision, because "signed" is not
 * "authorized" — the handle's expiry, revocation and grant live only at the
 * issuer. Also false for an encrypted token that declares no claims payload
 * (`verify` refuses those outright: an unsigned or opaque plaintext is not
 * sender-authenticated), and for anything that is not a token at all.
 *
 * ⚠ SNIFFED from the wire, keylessly, and never inferred from a FAILED verify:
 * "it did not verify, so it must be opaque" would launder a tampered JWT into an
 * introspection call, asking an authorization server about a string it never
 * issued. A token this rejects must be introspected; a token it accepts must be
 * verified, and a verification failure is a rejection.
 *
 * Never throws — malformed input is simply not claims-bearing.
 */
export const isClaimsBearingToken = (token: string): boolean => {
  if (JwtKit.isJwt(token)) return true;
  if (JweKit.isJwe(token)) return isClaimsContentType(joseCty(token));

  // A JOSE token is dot-delimited and a COSE token never is, so anything still
  // dotted here is a JWS (opaque) or not a token — the same cheap gate
  // `Aegis.isCose` applies before doing any CBOR work.
  if (token.includes(".")) return false;

  const bytes = Buffer.from(token, "base64url");

  if (isCwt(bytes) || isCwm(bytes)) return true;
  if (isCwe(bytes)) return isClaimsContentType(coseCty(bytes));

  return false;
};
