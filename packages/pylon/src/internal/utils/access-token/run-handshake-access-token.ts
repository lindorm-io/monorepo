import { ClientError } from "@lindorm/errors";
import type {
  AccessTokenMatchers,
  AccessTokenProfile,
  HandshakeDpopMode,
  PylonAuthCacheEntry,
  PylonSocketAuth,
  PylonSocketHandshakeContext,
} from "../../../types/index.js";
import { registerBearerHandshakeAuth } from "../handshake/register-bearer-handshake-auth.js";
import { createSessionRefreshHandler } from "../refresh/create-session-refresh-handler.js";
import { deploymentCritical } from "../tokens/deployment-critical.js";
import { extractTokenFromSession } from "../tokens/extract-token-from-session.js";
import { resolveHandshakeTokenSource } from "../tokens/resolve-handshake-token-source.js";
import { sessionResolvedAccess } from "../tokens/session-resolved-access.js";
import { assertResolvedAccess } from "./assert-resolved-access.js";
import { resolveAccessIssuer } from "./resolve-access-issuer.js";

type Options = {
  cache: PylonAuthCacheEntry | undefined;
  dpopMode: HandshakeDpopMode;
  matchers: AccessTokenMatchers;
  profile: AccessTokenProfile;
};

/**
 * The socket-handshake layer that OBTAINS a credential — the twin of
 * `runHttpAccessToken`, differing only in where the credential is read from.
 */
export const runHandshakeAccessToken = async (
  ctx: PylonSocketHandshakeContext,
  options: Options,
): Promise<void> => {
  const socket = ctx.io.socket;
  const source = resolveHandshakeTokenSource(socket);

  if (source.kind === "bearer" || source.kind === "dpop") {
    await registerBearerHandshakeAuth(ctx, {
      cache: options.cache,
      dpopMode: options.dpopMode,
      dpopProof: source.kind === "dpop" ? source.dpopProof : undefined,
      matchers: options.matchers,
      profile: options.profile,
      token: source.token,
    });
    return;
  }

  if (source.kind === "session") {
    // The connection session middleware may already have registered auth from
    // the cookie; a second registration would replace a live refresh handler
    // with an equivalent one for no reason.
    if (socket.data.pylon.auth) return;

    const critical = deploymentCritical(ctx.state.app.config.auth);

    const parsed = await extractTokenFromSession(ctx.aegis, source.session, critical);
    if (parsed) {
      const access = sessionResolvedAccess(source.session.accessToken, parsed);

      // The SAME assert the header arms run — see the HTTP session arm.
      assertResolvedAccess(access, {
        issuer: resolveAccessIssuer(ctx),
        matchers: options.matchers,
      });

      // ⚠ No binding check, for the same reason as the HTTP session arm: a
      // cookie credential carries no proof, and `extractTokenFromSession`
      // verifies with aegis's RFC 9449-strict default, which refuses a
      // `cnf.jkt`-bound token outright — so a bound credential never reaches
      // here and a check placed after it would be unreachable.
      socket.data.tokens.bearer = parsed;
      socket.data.pylon.access = access;
    }

    const auth: PylonSocketAuth = {
      strategy: "session",
      getExpiresAt: () =>
        source.session.expiresAt ?? parsed?.claims.expiresAt ?? new Date(0),
      refresh: async () => {},
      authExpiredEmittedAt: null,
    };
    auth.refresh = createSessionRefreshHandler({
      aegis: ctx.aegis,
      critical,
      lookup: async () => source.session,
      socket,
    });
    socket.data.pylon.auth = auth;
    return;
  }

  throw new ClientError("Unauthorized handshake", {
    status: ClientError.Status.Unauthorized,
    code: "handshake_unauthorized",
    type: "urn:lindorm:pylon:error:handshake_unauthorized",
    title: "Handshake Unauthorized",
    details:
      "Socket handshake provided no recognised credentials (bearer, dpop, or session)",
    data: { source: source.kind },
  });
};
