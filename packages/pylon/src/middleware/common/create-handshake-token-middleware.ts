import { VerifyJwtOptions } from "@lindorm/aegis";
import { ClientError } from "@lindorm/errors";
import {
  HandshakeDpopMode,
  registerBearerHandshakeAuth,
} from "../../internal/utils/handshake/register-bearer-handshake-auth";
import { resolveHandshakeTokenSource } from "../../internal/utils/tokens/resolve-handshake-token-source";
import { createSessionRefreshHandler } from "../../internal/utils/refresh/create-session-refresh-handler";
import { extractTokenFromSession } from "../../internal/utils/tokens/extract-token-from-session";
import {
  PylonConnectionMiddleware,
  PylonSocketAuth,
  PylonSocketHandshakeContext,
} from "../../types";

type Options = Omit<VerifyJwtOptions, "issuer"> & {
  issuer: string;
  dpop?: HandshakeDpopMode;
};

export const createHandshakeTokenMiddleware = <
  C extends PylonSocketHandshakeContext = PylonSocketHandshakeContext,
>(
  options: Options,
): PylonConnectionMiddleware<C> => {
  const dpopMode: HandshakeDpopMode = options.dpop ?? "optional";
  const { dpop: _dpop, ...verifyOptions } = options;

  return async function handshakeTokenMiddleware(ctx, next): Promise<void> {
    const socket = ctx.io.socket;
    const source = resolveHandshakeTokenSource(socket);

    if (source.kind === "bearer" || source.kind === "dpop") {
      await registerBearerHandshakeAuth({
        aegis: ctx.aegis,
        dpopMode,
        dpopProof: source.kind === "dpop" ? source.dpopProof : undefined,
        socket,
        token: source.token,
        verifyOptions,
      });
      return next();
    }

    if (source.kind === "session") {
      if (socket.data.pylon.auth) return next();

      const parsed = await extractTokenFromSession(ctx.aegis, source.session);
      if (parsed) socket.data.tokens.bearer = parsed;

      const auth: PylonSocketAuth = {
        strategy: "session",
        getExpiresAt: () =>
          source.session.expiresAt ?? parsed?.payload.expiresAt ?? new Date(0),
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
      return next();
    }

    throw new ClientError("Unauthorized handshake", {
      status: ClientError.Status.Unauthorized,
    });
  };
};
