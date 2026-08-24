import type { TokenType } from "../../constants/token-type.js";
import type { TokenProfile } from "../../types/index.js";
import { computeTypHeader, extractTypPrefix } from "./compute-typ-header.js";

/**
 * The bare typ PREFIX a PROFILED write stamps — `aegis.mint`, on every format it
 * emits.
 *
 * ⭐ ONE derivation, ABOVE the wire seam, for the same reason
 * {@link import("./sign-typ-prefix.js").signTypPrefix} is: nothing in this chain
 * differs between a JOSE and a COSE write, so a per-wire copy would be two
 * expressions with nothing holding them equal. The final spelling does not differ
 * either — the result is the bare PREFIX each wire's own kit re-wraps, so
 * `"custom"` becomes `application/custom+jwt` on a JWT and
 * `application/custom+cwt` on a CWT.
 *
 * The profile's mandated type wins; then the caller's explicit `sign.typ`; then
 * the content's own `tokenType`, which floors to the bare form the kit requires.
 *
 * ⚠ `?? ` and not `||`: `SignTokenOptions.typ` admits `null`, and only `null` and
 * `undefined` mean the caller stated nothing.
 *
 * ⚠ A profile whose `typ.value` is neither a `+jwt` media type nor the bare
 * conventional form has no prefix to extract, and `extractTypPrefix` refuses it on
 * every format. Nothing validates a profile's `typ` at registration
 * (`internal/profiles/define-profile.ts`), so that refusal is the only thing
 * standing between such a profile and a token typed by neither its profile nor its
 * caller. RFC 8725 §3.11.
 */
export const mintTypPrefix = ({
  contentTokenType,
  profile,
  signTyp,
}: {
  /** The content's own domain `tokenType`, when it carries one. */
  contentTokenType: TokenType | undefined;
  profile: TokenProfile;
  /** The caller's explicit `SignTokenOptions.typ`. */
  signTyp: string | null | undefined;
}): string | undefined =>
  extractTypPrefix(
    profile.typ.presence !== "none"
      ? profile.typ.value
      : (signTyp ?? computeTypHeader(contentTokenType, "jwt")),
    "jwt",
  );
