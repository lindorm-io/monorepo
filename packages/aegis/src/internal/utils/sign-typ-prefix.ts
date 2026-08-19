import type { TokenType } from "../../constants/token-type.js";
import { domainTokenTypePrefix, extractTypPrefix } from "./compute-typ-header.js";

/**
 * The bare typ PREFIX a PROFILE-LESS write stamps — `aegis.sign`, on every format
 * it emits.
 *
 * ⭐ ONE derivation, ABOVE the wire seam, and the placement is the rule rather
 * than a convenience: with no profile to consult, nothing in this chain differs
 * between a JOSE and a COSE write, so it is NOT a `TokenWire` member. A per-wire
 * copy would be two expressions with nothing holding them equal, and only the
 * profile makes the two wires genuinely disagree (`TokenWire.mintTypPrefix`).
 *
 * The caller's explicit `typ` wins; else their `tokenType`. BOTH are OPTIONS on
 * `RawSignInput`, siblings of `payload` — this verb reads nothing out of the
 * payload, so a `tokenType` written among the claims is a claim and never a
 * directive. (`mint` is the one that reads a CONTENT `tokenType`, through
 * `TokenWire.mintTypPrefix` — on the JOSE wire; the COSE arm takes `profile`
 * and `format` alone, so it reads neither the content type nor a caller `typ`.)
 *
 * Both reduce through the JOSE spelling, which is what the kits re-wrap: the prefix
 * `"at"` becomes `application/at+jwt` on a JWS/JWT and `application/at+cwt` on a
 * CWT/CWS, so one prefix serves every format. A token type whose short name is
 * the bare conventional form (`id_token` → `JWT`) reduces to `undefined`, and
 * each kit then stamps its OWN wire's bare form.
 *
 * `sign-typ-prefix.test.ts` pins this function's own answers; that the answers
 * reach the emitted header on every format is pinned end-to-end by
 * `sign-token.test.ts` ("stamps its own bare form", "honours an explicit typ").
 */
export const signTypPrefix = ({
  typ,
  tokenType,
}: {
  /** The caller's explicit `RawSignInput.typ` — a full media type or a bare form. */
  typ: string | undefined;
  /** The caller's `RawSignInput.tokenType` — the domain enum. */
  tokenType: TokenType | undefined;
}): string | undefined =>
  typ !== undefined ? extractTypPrefix(typ, "jwt") : domainTokenTypePrefix(tokenType);
