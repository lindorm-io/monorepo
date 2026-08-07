import { isExpired } from "@lindorm/date";
import type { IProteusSource } from "@lindorm/proteus";
import { omitUndefined } from "@lindorm/utils";
import type {
  PylonConnectionMiddleware,
  PylonCookieSettings,
  PylonGetCookieOptions,
  PylonSessionSettings,
  PylonSocketAuth,
  PylonSocketHandshakeContext,
} from "../../types/index.js";
import { SESSION_COOKIE_NAME } from "../constants/session.js";
import { createGetCookie } from "../utils/cookies/create-get-cookie.js";
import { parseCookieHeader } from "../utils/cookies/parse-cookie-header.js";
import { createSessionStore } from "../utils/create-session-store.js";
import { resolveSessionKeys } from "../utils/keys/resolve-session-keys.js";
import { createSessionRefreshHandler } from "../utils/refresh/create-session-refresh-handler.js";
import { extractTokenFromSession } from "../utils/tokens/extract-token-from-session.js";

export const createConnectionSessionMiddleware = <
  C extends PylonSocketHandshakeContext = PylonSocketHandshakeContext,
>(
  kv: IProteusSource | undefined,
  options: PylonSessionSettings,
  cookies?: PylonCookieSettings,
): PylonConnectionMiddleware<C> => {
  // The session cookie's keys travel in the config — the handshake reads the
  // cookie through this config, not a per-call options object. A CONFIGURED key
  // turns its role on the same way the HTTP session middleware does
  // (`auth.session.<role> ?? cookies.<role>`), preserving the fail-closed
  // contract for a NAMED-but-unresolvable key.
  const sk = resolveSessionKeys(options, cookies);

  // READ-only: the handshake never writes a cookie, so this carries the read
  // policy alone. `base64url` is the same codec the http cookies middleware
  // defaults to — the session cookie's value is pylon's own opaque handle, so
  // both ends agree on it by construction rather than by configuration.
  const config: PylonGetCookieOptions = omitUndefined({
    encoding: "base64url",
    encrypted: sk.encryption ? true : undefined,
    signed: sk.verification,
  });

  const store = createSessionStore(kv, options, cookies);

  return async function connectionSessionMiddleware(ctx, next): Promise<void> {
    const socket = ctx.io.socket;
    const cookieHeader = socket.handshake?.headers?.cookie;

    if (!cookieHeader) {
      return next();
    }

    const parsed = parseCookieHeader(cookieHeader);
    const getCookie = createGetCookie({
      ctx,
      config,
      parsed,
      signature: cookies?.signature,
      encryption: cookies?.encryption,
    });

    const sessionId = await getCookie<string>(SESSION_COOKIE_NAME);

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
    if (session.expiresAt && isExpired(session.expiresAt, now)) {
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
      session.expiresAt ?? parsedToken?.claims.expiresAt ?? new Date(0);

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
