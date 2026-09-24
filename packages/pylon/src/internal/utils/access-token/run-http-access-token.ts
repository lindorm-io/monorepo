import { ClientError } from "@lindorm/errors";
import type {
  AccessTokenMatchers,
  AccessTokenProfile,
  PylonAuthCacheEntry,
  PylonHttpContext,
} from "../../../types/index.js";
import { assertDpopBinding } from "../dpop/assert-dpop-binding.js";
import { deploymentCritical } from "../tokens/deployment-critical.js";
import { extractTokenFromSession } from "../tokens/extract-token-from-session.js";
import { resolveHttpTokenSource } from "../tokens/resolve-http-token-source.js";
import { sessionResolvedAccess } from "../tokens/session-resolved-access.js";
import { assertResolvedAccess } from "./assert-resolved-access.js";
import { resolveAccess } from "./resolve-access.js";
import { resolveAccessIssuer } from "./resolve-access-issuer.js";

type Options = {
  cache: PylonAuthCacheEntry | undefined;
  matchers: AccessTokenMatchers;
  profile: AccessTokenProfile;
};

/**
 * The HTTP layer that OBTAINS a credential. Everything after the obtain is the
 * shared code — `resolveAccess`, then the ONE `assertResolvedAccess` pass — so a
 * matcher stated on the mount applies the same way whichever way the credential
 * arrived, header or cookie.
 */
export const runHttpAccessToken = async (
  ctx: PylonHttpContext,
  options: Options,
): Promise<void> => {
  const source = resolveHttpTokenSource(ctx);

  if (source.kind === "bearer" || source.kind === "dpop") {
    const dpopProof =
      source.kind === "dpop"
        ? ((ctx.get("dpop") as string | undefined) ?? undefined)
        : undefined;

    if (source.kind === "dpop" && (!dpopProof || dpopProof.length === 0)) {
      throw new ClientError("Missing DPoP header", {
        details: "DPoP scheme requires a DPoP header on the request",
        status: ClientError.Status.Unauthorized,
        code: "missing_dpop_header",
        type: "urn:lindorm:pylon:error:missing_dpop_header",
        title: "Missing DPoP Header",
        data: { scheme: "dpop" },
      });
    }

    const { access, issuer, verified } = await resolveAccess(ctx, source.token, {
      audience: options.matchers.audience,
      cache: options.cache,
      profile: options.profile,
      // The one transport that HAS an RFC 6749 §7.1 presentation scheme — the
      // caller chose it in the `Authorization` header, and `resolveHttpTokenSource`
      // already normalised it to this pair.
      scheme: source.kind,
    });

    assertResolvedAccess(access, { issuer, matchers: options.matchers });

    // `ctx.state.tokens.accessToken` is left UNSET on the introspected arm:
    // there is no VerifiedToken, and synthesising one would erase the very
    // provenance distinction `ctx.state.access` exists to preserve.
    if (verified) ctx.state.tokens.accessToken = verified;
    ctx.state.access = access;

    assertDpopBinding(access, {
      htm: ctx.method,
      htu: { origin: ctx.origin, path: ctx.path },
      proof: dpopProof,
      scheme: source.kind === "dpop",
    });
    return;
  }

  if (source.kind === "session") {
    const parsed = await extractTokenFromSession(
      ctx.aegis,
      source.session,
      deploymentCritical(ctx.state.app.config.auth),
    );
    if (!parsed) {
      throw new ClientError("Invalid session access token", {
        status: ClientError.Status.Unauthorized,
        code: "invalid_session_access_token",
        type: "urn:lindorm:pylon:error:invalid_session_access_token",
        title: "Invalid Session Access Token",
        details: "No access token could be extracted from the session",
        debug: { sessionId: source.session.id },
      });
    }

    const access = sessionResolvedAccess(source.session.accessToken, parsed);

    // The cookie-session arm answers to the SAME assert as the header arms.
    // There are no sessions without a settled issuer — the session was minted by
    // this deployment — so it has no reason to sit outside: leaving it out meant
    // a mount's `audience` (and every other matcher) silently did not apply to a
    // browser-presented credential.
    assertResolvedAccess(access, {
      issuer: resolveAccessIssuer(ctx),
      matchers: options.matchers,
    });

    ctx.state.tokens.accessToken = parsed;
    ctx.state.access = access;

    // ⚠ No `assertDpopBinding` here, and that is not an omission. A cookie
    // credential carries no proof, and `extractTokenFromSession` verifies with
    // aegis's RFC 9449-strict default (no `trustBoundThumbprint`), which REFUSES
    // a `cnf.jkt`-bound token outright — so a bound credential never reaches this
    // line and a binding check placed after it would be unreachable. The header
    // arms need their own check precisely because they DO pass
    // `trustBoundThumbprint` in order to own the proof comparison themselves.
    return;
  }

  throw new ClientError("Invalid credentials", {
    details: "No authorization header or session available",
    status: ClientError.Status.Unauthorized,
    code: "missing_credentials",
    type: "urn:lindorm:pylon:error:missing_credentials",
    title: "Missing Credentials",
    data: { source: source.kind },
  });
};
