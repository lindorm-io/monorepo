import { ServerError } from "@lindorm/errors";
import type { IProteusSource } from "@lindorm/proteus";
import { omitUndefined } from "@lindorm/utils";
import type { IPylonSession, PylonSessionHandle } from "../../interfaces/index.js";
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
import { parseSessionTokens } from "../utils/parse-session-tokens.js";
import { createSessionSecret } from "../utils/session/create-session-secret.js";
import { isSessionHandle } from "../utils/session/is-session-handle.js";

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

  const store = createSessionStore(kv, options);

  return async function httpSessionMiddleware(ctx, next) {
    // Read ONCE, before `ctx.session` exists — the cookie a request arrived with
    // is a fact about the request, not something to re-derive per call. (The
    // cookie reader caches per request anyway, so a later re-read could only ever
    // answer with this same value — after a `set` it would answer with the value
    // that `set` REPLACED.)
    const cookie = await ctx.cookies.get(SESSION_COOKIE_NAME, config);

    // THE REQUEST'S HANDLE — `{ id, sec }`. It lives in this closure and nowhere
    // else: the route handler calls `ctx.session.set(session)` and never sees a
    // handle, so mint-or-reuse is decided here, by whoever read the cookie.
    //
    // Reuse is not an optimisation, it is the contract. The secret does NOT
    // rotate on write, so an update MUST re-seal under the secret the browser
    // already holds — minting a fresh one on a refresh would re-seal the row
    // under a key the deployment's other tabs do not have, and every concurrent
    // refresh would become a hard logout race. `null` here means either no
    // cookie arrived or it did not resolve, and both mint.
    //
    // `seen` is separate from `handle` deliberately: a cookie that arrived and did
    // NOT resolve — wrong shape, dead row, wrong secret — is the one the request
    // clears, and a request that sent no cookie at all must not be answered with a
    // `Set-Cookie` deleting one it never had.
    const incoming: { handle: PylonSessionHandle | null; seen: boolean } = {
      handle: store && isSessionHandle(cookie) ? cookie : null,
      seen: cookie !== null && cookie !== undefined,
    };

    ctx.session = {
      set: async (session: IPylonSession): Promise<void> => {
        let value: unknown = session;

        if (store) {
          // ONE rule: reuse the incoming secret iff the incoming cookie's id
          // equals the id being written; otherwise mint. A fresh login carries
          // a new id (or no cookie at all) and gets a new secret; a refresh
          // keeps both, which is what keeps `metadata.sessionId` correlation and
          // the id a live socket captured at handshake stable.
          const next: PylonSessionHandle =
            incoming.handle && incoming.handle.id === session.id
              ? incoming.handle
              : { id: session.id, sec: createSessionSecret() };

          await store.set(ctx, next, session);

          incoming.handle = next;
          incoming.seen = true;
          value = next;
        }

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
        // COOKIE-ONLY: no store, so the cookie IS the session object. The handle
        // shape never reaches this branch.
        if (!store) return (cookie as IPylonSession | null) ?? null;

        if (!incoming.handle) return null;

        return await store.get(ctx, incoming.handle);
      },

      del: async (): Promise<void> => {
        // The handle read at request start, not a re-read of the cookie: after a
        // `set` in this same request the cookie jar still holds the INCOMING
        // value, so a re-read would delete the row this request replaced.
        if (store && incoming.handle) {
          await store.del(ctx, incoming.handle.id);
        }
        incoming.handle = null;
        incoming.seen = false;
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

    // ONE outcome for every "a signature-valid session cookie did not resolve to
    // a live session": stale shape, deleted row, or a secret that does not open
    // it. The cookie is cleared, the fact is logged, and the request proceeds
    // UNAUTHENTICATED — whatever guards the route produces the 401. No new
    // status, no new error type, and the ROW is left alone: a snapshot/restore
    // skew must never let a stale cookie destroy a live session.
    //
    // Store-backed only. A cookie-only session has no second place to disagree
    // with, so there is no unresolvable-cookie state to clear.
    if (store && incoming.seen && !ctx.state.session) {
      ctx.logger.warn("Session cookie did not resolve to a live session; clearing it", {
        sessionId: incoming.handle?.id ?? null,
      });

      incoming.handle = null;
      incoming.seen = false;
      ctx.cookies.del(SESSION_COOKIE_NAME);
    }

    if (ctx.state.session) {
      ctx.state.metadata.sessionId = ctx.state.session.id;
      ctx.logger.correlation({ sessionId: ctx.state.session.id });
    }

    // The parsed buckets are a projection of the session, so they are derived
    // by the SAME function everywhere the session is written — here, and again
    // in the refresh middleware when a grant replaces it.
    await parseSessionTokens(ctx, ctx.state.session);

    await next();
  };
};
