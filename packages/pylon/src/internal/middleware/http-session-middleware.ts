import { AegisError } from "@lindorm/aegis";
import { ServerError } from "@lindorm/errors";
import type { IProteusSource } from "@lindorm/proteus";
import { omitUndefined } from "@lindorm/utils";
import type { IPylonSession } from "../../interfaces/index.js";
import type {
  PylonCookieSettings,
  PylonGetCookieOptions,
  PylonHttpMiddleware,
  PylonSessionSettings,
  PylonSetCookieOptions,
} from "../../types/index.js";
import { SESSION_COOKIE_NAME } from "../constants/session.js";
import { createSessionStore } from "../utils/create-session-store.js";
import { resolveSessionKeys } from "../utils/keys/resolve-session-keys.js";

export const createHttpSessionMiddleware = (
  kv: IProteusSource | undefined,
  options: PylonSessionSettings,
  cookies?: PylonCookieSettings,
): PylonHttpMiddleware => {
  // The session cookie is a cookie like any other, so its keys reach the signer
  // and the cipher the way any cookie's do: named in the config handed to
  // `ctx.cookies.set` / `.get`. Pylon never sniffs cookie names.
  //
  // A CONFIGURED key turns its role on: `resolveSessionKeys` folds
  // `session.<role> ?? cookies.<role>` into concrete selectors, and a resolved
  // role becomes the cookie's `signature`/`encryption` selector on the SET side
  // and its `encrypted`/`signed` policy on the READ side. No key ⇒ the field is
  // dropped and the role is off. The throwing resolver still fires when a NAMED
  // key cannot be resolved — an encrypted session fails closed, never silently
  // writes plaintext.
  const sk = resolveSessionKeys(options, cookies);

  // The STATIC attributes — everything that is the same for every session this
  // deployment writes. Hoisted once, and used verbatim on the read side.
  //
  // `httpOnly` is forced, not declared: the cookie addresses an access token, an
  // id token and a refresh token, so `httpOnly: false` would hand all three to
  // any XSS. No deployment wants JS reading it. `encoding` is likewise not the
  // deployment's — the value is a store id or a sealed blob, both pylon's own —
  // so it inherits the cookie middleware's `base64url`.
  const config: PylonSetCookieOptions & PylonGetCookieOptions = omitUndefined({
    domain: options.domain,
    httpOnly: true,
    path: options.path,
    priority: options.priority,
    sameSite: options.sameSite,
    secure: options.secure,
    encryption: sk.encryption,
    signature: sk.signature,
    encrypted: sk.encryption ? true : undefined,
    signed: sk.verification,
  });

  const store = createSessionStore(kv, options, cookies);

  return async function httpSessionMiddleware(ctx, next) {
    ctx.session = {
      set: async (session: IPylonSession): Promise<void> => {
        const value = store ? await store.set(ctx, session) : session;

        // The cookie's expiry IS the session's — derived per write, never
        // configured. A separate max-age could only disagree with the record it
        // addresses: outlive it and the browser holds a pointer to nothing,
        // under-live it and a valid session becomes unreachable. A null
        // `expiresAt` means the session has no deadline of its own, which maps
        // to no expiry attribute at all — a browser-session cookie.
        await ctx.cookies.set(
          SESSION_COOKIE_NAME,
          value,
          session.expiresAt ? { ...config, expiry: session.expiresAt } : config,
        );
      },

      get: async (): Promise<IPylonSession | null> => {
        const cookie = await ctx.cookies.get(SESSION_COOKIE_NAME, config);
        const value = store ? await store.get(ctx, cookie) : cookie;
        return value ?? null;
      },

      del: async (): Promise<void> => {
        if (store) {
          const cookie = await ctx.cookies.get(SESSION_COOKIE_NAME, config);
          await store.del(ctx, cookie);
        }
        ctx.cookies.del(SESSION_COOKIE_NAME);
      },

      logout: async (subject: string): Promise<void> => {
        if (store) {
          await store.logout(ctx, subject);
        } else {
          throw new ServerError("Session logout requires a configured session store", {
            code: "session_store_not_configured",
            title: "Session Store Not Configured",
            type: "urn:lindorm:pylon:error:session_store_not_configured",
            details:
              "logout() was called but no session store is configured; cookie-only sessions cannot perform a server-side logout",
            debug: { subject },
          });
        }
      },
    };

    ctx.state.session = await ctx.session.get();

    if (ctx.state.session) {
      ctx.state.metadata.sessionId = ctx.state.session.id;
      ctx.logger.correlation({ sessionId: ctx.state.session.id });
    }

    if (ctx.state.session?.accessToken) {
      try {
        const verified = await ctx.aegis.verify(ctx.state.session.accessToken);
        if (verified.format === "jwt") {
          ctx.state.tokens.accessToken = verified;
        }
      } catch (err) {
        if (!(err instanceof AegisError)) throw err;
      }
    }

    if (ctx.state.session?.idToken) {
      try {
        const verified = await ctx.aegis.verify(ctx.state.session.idToken);
        if (verified.format === "jwt") {
          ctx.state.tokens.idToken = verified;
        }
      } catch (err) {
        if (!(err instanceof AegisError)) throw err;
      }
    }

    await next();
  };
};
