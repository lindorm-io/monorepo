import { omitUndefined } from "@lindorm/utils";
import type {
  PylonConnectionMiddleware,
  PylonCookieSettings,
  PylonGetCookieOptions,
  PylonSessionSettings,
  PylonSetCookieOptions,
  PylonSocketAuth,
  PylonSocketHandshakeContext,
} from "../../types/index.js";
import { createGetCookie } from "../utils/cookies/create-get-cookie.js";
import { parseCookieHeader } from "../utils/cookies/parse-cookie-header.js";
import { createSessionStore } from "../utils/create-session-store.js";
import { resolveSessionKeys } from "../utils/keys/resolve-session-keys.js";
import { createSessionRefreshHandler } from "../utils/refresh/create-session-refresh-handler.js";
import { extractTokenFromSession } from "../utils/tokens/extract-token-from-session.js";

export const createConnectionSessionMiddleware = <
  C extends PylonSocketHandshakeContext = PylonSocketHandshakeContext,
>(
  options: PylonSessionSettings,
  cookies?: PylonCookieSettings,
): PylonConnectionMiddleware<C> => {
  const name = options.name ?? "pylon_session";

  // The session cookie's keys travel in the config — the handshake reads the
  // cookie through this config, not a per-call options object. A CONFIGURED key
  // turns its role on the same way the HTTP session middleware does
  // (`session.<role> ?? cookies.<role>`), preserving the fail-closed contract
  // for a NAMED-but-unresolvable key.
  const sk = resolveSessionKeys(options, cookies);

  const config: PylonSetCookieOptions & PylonGetCookieOptions = omitUndefined({
    domain: options.domain,
    encoding: options.encoding ?? "base64url",
    expiry: options.expiry,
    httpOnly: options.httpOnly,
    path: options.path,
    priority: options.priority,
    sameSite: options.sameSite,
    secure: options.secure,
    encryption: sk.encryption,
    signature: sk.signature,
    encrypted: sk.encryption ? true : undefined,
    signed: sk.verification,
  });

  const store = createSessionStore(options, cookies);

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
