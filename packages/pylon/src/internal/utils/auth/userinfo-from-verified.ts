import { isStructuredToken, type VerifiedToken } from "@lindorm/aegis";
import { isString } from "@lindorm/is";
import type { PylonUserinfo } from "../../../types/index.js";

/**
 * Build a userinfo answer from a token `verify` already returned — the LOCAL
 * fast path, and the twin of the introspection one.
 *
 * ⚠ It reads the BUCKETS, not the wire. A `VerifiedToken` already carries its
 * claims categorised by registry (`claims`/`custom`/`profile`), domain-keyed and
 * uniform across JOSE and COSE. The previous shape dug `wire.payload` back out
 * and re-ran the JOSE translator over it — translating what aegis had already
 * translated, and doing it with the wrong translator for a CWT, whose wire dict
 * is COSE-name-keyed.
 *
 * `null` means "the fast path does not apply", never an error: a token with no
 * `subject` cannot answer a userinfo request locally, so the caller falls
 * through to the provider's endpoint. Throwing here would raise
 * `UserinfoEndpointFailed` for a request that never reached an endpoint.
 *
 * ⚠ `sensitive` is spread in WITHOUT a gate here on purpose. Aegis populates
 * that bucket ONLY from an ENCRYPTED token (jwe/cwe) and suppresses it on every
 * other format (OIDC Core §13.3), so the release condition is already decided
 * upstream — on anything else the bucket is `undefined` and the spread is a
 * no-op. Re-deciding it here would be a second, drifting copy of that rule.
 * This is also the case that only became reachable once the gate stopped being
 * `format === "jwt"`: an encrypted id token is exactly the token that carries it.
 *
 * {@link parseUserinfo} remains the REMOTE half — a raw JSON body from the
 * provider's userinfo endpoint is untranslated wire and does need the translator.
 */
export const userinfoFromVerified = (
  token: VerifiedToken | null | undefined,
): PylonUserinfo | null =>
  isStructuredToken(token) && isString(token.claims.subject)
    ? { ...token.profile, ...token.sensitive, subject: token.claims.subject }
    : null;
