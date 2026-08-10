import type { DomainAssert, VerifyOptions } from "@lindorm/aegis";
import { ClientError } from "@lindorm/errors";
import type {
  HandshakeDpopMode,
  PylonAuthCacheEntry,
  PylonSocketAuth,
  PylonSocketHandshakeContext,
} from "../../../types/index.js";
import { registerBearerHandshakeAuth } from "../handshake/register-bearer-handshake-auth.js";
import { createSessionRefreshHandler } from "../refresh/create-session-refresh-handler.js";
import { extractTokenFromSession } from "../tokens/extract-token-from-session.js";
import { resolveHandshakeTokenSource } from "../tokens/resolve-handshake-token-source.js";
import { sessionResolvedAccess } from "../tokens/session-resolved-access.js";

type Options = {
  cache: PylonAuthCacheEntry | undefined;
  dpopMode: HandshakeDpopMode;
  matchers: DomainAssert;
  verifyOptions: VerifyOptions;
};

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
      token: source.token,
      verifyOptions: options.verifyOptions,
    });
    return;
  }

  if (source.kind === "session") {
    // The connection session middleware may already have registered auth from
    // the cookie; a second registration would replace a live refresh handler
    // with an equivalent one for no reason.
    if (socket.data.pylon.auth) return;

    const parsed = await extractTokenFromSession(ctx.aegis, source.session);
    if (parsed) {
      socket.data.tokens.bearer = parsed;
      socket.data.pylon.access = sessionResolvedAccess(
        source.session.accessToken,
        parsed,
      );
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
      lookup: async () => source.session,
      sessionId: source.session.id,
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
