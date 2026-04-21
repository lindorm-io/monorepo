import { removeUndefined } from "@lindorm/utils";
import { createGetCookie } from "../utils/cookies/create-get-cookie.js";
import { parseCookieHeader } from "../utils/cookies/parse-cookie-header.js";
import { createSessionStore } from "../utils/create-session-store.js";
import { createSessionRefreshHandler } from "../utils/refresh/create-session-refresh-handler.js";
import { extractTokenFromSession } from "../utils/tokens/extract-token-from-session.js";
import type {
  PylonConnectionMiddleware,
  PylonSessionConfig,
  PylonSessionOptions,
  PylonSocketAuth,
  PylonSocketHandshakeContext,
} from "../../types/index.js";

export const createConnectionSessionMiddleware = <
  C extends PylonSocketHandshakeContext = PylonSocketHandshakeContext,
>(
  options: PylonSessionOptions,
): PylonConnectionMiddleware<C> => {
  const name = options.name ?? "pylon_session";

  const config: PylonSessionConfig = removeUndefined({
    domain: options.domain,
    encoding: options.encoding ?? "base64url",
    encrypted: options.encrypted,
    expiry: options.expiry,
    httpOnly: options.httpOnly,
    path: options.path,
    priority: options.priority,
    sameSite: options.sameSite,
    secure: options.secure,
    signed: options.signed,
  });

  const store = createSessionStore(options);

  return async function connectionSessionMiddleware(ctx, next): Promise<void> {
    const socket = ctx.io.socket;
    const cookieHeader = socket.handshake?.headers?.cookie;

    if (!cookieHeader) {
      return next();
    }

    const parsed = parseCookieHeader(cookieHeader);
    const getCookie = createGetCookie({ ctx, config, parsed });

    const sessionId = await getCookie<string>(name);

    if (!sessionId || typeof sessionId !== "string") {
      return next();
    }

    if (!store) {
      return next();
    }

    const session = await store.get(ctx, sessionId);

    if (!session) {
      return next();
    }

    const now = new Date();
    if (session.expiresAt && session.expiresAt.getTime() <= now.getTime()) {
      return next();
    }

    socket.data.session = session;

    if (socket.data.pylon.auth) {
      // Upstream middleware already populated auth — don't overwrite.
      return next();
    }

    const parsedToken = await extractTokenFromSession(ctx.aegis, session);
    if (parsedToken) {
      socket.data.tokens.bearer = parsedToken;
    }

    const initialExpiresAt: Date =
      session.expiresAt ?? parsedToken?.payload.expiresAt ?? new Date(0);

    const refresh = createSessionRefreshHandler({
      aegis: ctx.aegis,
      lookup: (id) => store.get(ctx, id),
      sessionId: session.id,
      socket,
    });

    const auth: PylonSocketAuth = {
      strategy: "session",
      getExpiresAt: () => initialExpiresAt,
      refresh,
      authExpiredEmittedAt: null,
    };

    socket.data.pylon.auth = auth;

    return next();
  };
};
