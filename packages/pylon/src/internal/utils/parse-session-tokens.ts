import { AegisError, isStructuredToken, type VerifiedToken } from "@lindorm/aegis";
import type { IPylonSession } from "../../interfaces/index.js";
import type { PylonCommonContext } from "../../types/index.js";
import { deploymentCritical } from "./tokens/deployment-critical.js";

/**
 * Verify ONE of the session's tokens, or answer `undefined` when there is no
 * parse to publish.
 *
 * An OPAQUE credential is the normal case for a provider that issues them, not
 * an error — it simply has no claims of its own to read, and the driver's
 * introspection endpoint is where they come from. A verify failure that is NOT
 * an aegis failure is something else entirely and is rethrown.
 */
const verifySessionToken = async (
  ctx: Pick<PylonCommonContext, "aegis">,
  token: string | undefined,
  critical: Array<string> | undefined,
): Promise<VerifiedToken | null> => {
  if (!token) return null;

  try {
    const verified = await ctx.aegis.verify(token, undefined, { critical });
    // Claims-bearing, not "is a JWT": a CWT/CWM carries claims, and so does a
    // JWE/CWE that wrapped one (verify returns the inner's claims under the
    // outer tag). Only jws/cws are genuinely opaque.
    return isStructuredToken(verified) ? verified : null;
  } catch (error) {
    if (!(error instanceof AegisError)) throw error;
    return null;
  }
};

/**
 * Re-derive `ctx.state.tokens.accessToken` / `.idToken` from the session.
 *
 * ONE path, run wherever `ctx.state.session` is written: by the session
 * middleware when the request's session is loaded, and by the refresh
 * middleware when a grant replaces or destroys it. The buckets are a PARSE of
 * the session's tokens, so they are only ever as current as the last write to
 * it — a refresh that left them alone had `ctx.auth.introspect()` answer with
 * the replaced token's claims, including its `exp`, because the claims client
 * reads them in preference to the session.
 *
 * A token that yields no parse DELETES its bucket rather than leaving the
 * previous one in place. Refreshing a structured credential onto an opaque one
 * is a legitimate provider behaviour, and a stale parse standing beside a fresh
 * session is worse than no parse at all: nothing downstream can tell it is not
 * describing the token the session actually holds.
 */
export const parseSessionTokens = async (
  ctx: Pick<PylonCommonContext, "aegis" | "state">,
  session: IPylonSession | null,
): Promise<void> => {
  const critical = deploymentCritical(ctx.state.app.config.auth);

  const accessToken = await verifySessionToken(ctx, session?.accessToken, critical);
  const idToken = await verifySessionToken(ctx, session?.idToken, critical);

  if (accessToken) {
    ctx.state.tokens.accessToken = accessToken;
  } else {
    delete ctx.state.tokens.accessToken;
  }

  if (idToken) {
    ctx.state.tokens.idToken = idToken;
  } else {
    delete ctx.state.tokens.idToken;
  }
};
