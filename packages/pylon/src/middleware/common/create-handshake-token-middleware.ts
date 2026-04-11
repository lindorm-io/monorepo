import { VerifyJwtOptions } from "@lindorm/aegis";
import { ClientError } from "@lindorm/errors";
import { resolveHandshakeTokenSource } from "#internal/utils/tokens/resolve-handshake-token-source";
import { createBearerRefreshHandler } from "#internal/utils/refresh/create-bearer-refresh-handler";
import { createSessionRefreshHandler } from "#internal/utils/refresh/create-session-refresh-handler";
import { extractTokenFromSession } from "#internal/utils/tokens/extract-token-from-session";
import {
  PylonConnectionMiddleware,
  PylonSocketAuth,
  PylonSocketHandshakeContext,
} from "../../types";

type Options = Omit<VerifyJwtOptions, "issuer"> & {
  issuer: string;
  // Phase 4: DPoP enforcement ("required" | "optional" | "disabled")
  // is declared here for the type contract but not wired yet.
  dpop?: "required" | "optional" | "disabled";
};

export const createHandshakeTokenMiddleware = <
  C extends PylonSocketHandshakeContext = PylonSocketHandshakeContext,
>(
  options: Options,
): PylonConnectionMiddleware<C> =>
  async function handshakeTokenMiddleware(ctx, next): Promise<void> {
    const socket = ctx.io.socket;
    const source = resolveHandshakeTokenSource(socket);

    if (source.kind === "bearer" || source.kind === "dpop") {
      // Phase 4 will branch on source.kind === "dpop" here to verify the
      // proof against the handshake upgrade URL and capture cnf.jkt.
      const verified = await ctx.aegis.verify(source.token, {
        tokenType: "access_token",
        ...options,
      });

      socket.data.tokens.bearer = verified;

      const auth: PylonSocketAuth = {
        strategy: "bearer",
        getExpiresAt: () => verified.payload.expiresAt ?? new Date(0),
        refresh: async () => {},
        authExpiredEmittedAt: null,
      };
      auth.refresh = createBearerRefreshHandler({
        aegis: ctx.aegis,
        socket,
        subject: verified.payload.subject,
        verifyOptions: { tokenType: "access_token", ...options },
      });
      socket.data.pylon.auth = auth;

      return next();
    }

    if (source.kind === "session") {
      if (socket.data.pylon.auth) {
        // Connection session middleware has already registered a
        // store-backed refresh handler — don't overwrite it.
        return next();
      }

      const parsed = extractTokenFromSession(source.session);
      if (parsed) {
        socket.data.tokens.bearer = parsed;
      }

      const auth: PylonSocketAuth = {
        strategy: "session",
        getExpiresAt: () =>
          source.session.expiresAt ?? parsed?.payload.expiresAt ?? new Date(0),
        refresh: async () => {},
        authExpiredEmittedAt: null,
      };
      auth.refresh = createSessionRefreshHandler({
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
