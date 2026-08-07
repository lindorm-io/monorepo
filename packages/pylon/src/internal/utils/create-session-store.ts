import { AesKit } from "@lindorm/aes";
import type { IProteusSession, IProteusSource } from "@lindorm/proteus";
import type { IPylonSession } from "../../interfaces/index.js";
import type { IPylonSessionStore } from "../../interfaces/PylonSessionStore.js";
import type {
  PylonCommonContext,
  PylonCookieSettings,
  PylonSessionSettings,
} from "../../types/index.js";
import { buildHookMeta } from "./build-hook-meta.js";
import { encryptCookie } from "./cookies/encrypt-cookie.js";
import { resolveSessionKeys } from "./keys/resolve-session-keys.js";
import { resolveActor } from "./resolve-actor.js";

/**
 * The store takes the `kv` SOURCE, not `ctx.kv`.
 *
 * ⚠ It has to. The session middleware runs BEFORE the dependencies middleware
 * that installs `ctx.kv` — and the socket handshake chain never runs that
 * middleware at all — so `ctx.kv` is undefined on exactly the paths that read
 * the session. The store therefore opens its own request-scoped session,
 * carrying this request's logger and hook meta.
 */
const openSession = (ctx: PylonCommonContext, kv: IProteusSource): IProteusSession =>
  kv.session({ logger: ctx.logger, meta: buildHookMeta(ctx, resolveActor(ctx)) });

let cachedSession: typeof import("../../entities/Session.js").Session | undefined;
const getSessionEntity = async (): Promise<
  typeof import("../../entities/Session.js").Session
> => {
  if (!cachedSession) {
    cachedSession = (await import("../../entities/Session.js")).Session;
  }
  return cachedSession;
};

export const createSessionStore = (
  kv: IProteusSource | undefined,
  options?: PylonSessionSettings,
  cookies?: PylonCookieSettings,
): IPylonSessionStore | undefined => {
  // No `kv` configured ⇒ NO store, and the session is cookie-only: the caller
  // puts the whole session object in the cookie and reads it back out. A store
  // that exists but has nowhere to write is worse than none — `set` would return
  // an id nothing holds and `get` would answer null for it, so the session would
  // be write-only.
  if (!options?.enabled || !kv) return;

  // Captured as a `const` so the closures below see the narrowed source rather
  // than the optional parameter.
  const source = kv;

  // Same key that seals the session COOKIE:
  // `auth.session.encryption ?? cookies.encryption`. A stored session and a
  // cookie-only session are the same secret in two places — the store just holds
  // it at rest instead of on the wire.
  const { encryption: encryptionKey } = resolveSessionKeys(options, cookies);

  // The `Session` entity lives in the AUTHORITATIVE `kv` source and nowhere
  // else — evicting a session logs the user out.
  return {
    set: async (ctx, session): Promise<string> => {
      const proteus = openSession(ctx, source);

      // Encryption at rest follows the same rule as proteus `@Encrypted`: naming
      // a session enc key (`session.encryption ?? cookies.encryption`) is what
      // turns it on, and a NAMED key that cannot be resolved throws
      // rather than persisting a bearer token in the clear. There is deliberately
      // no `canEncrypt()` fallback — it would query the PUBLISHED set and seal the
      // session with the JWKS token key. Unnamed ⇒ stored as-is, never guessed.
      if (encryptionKey) {
        session.accessToken = await encryptCookie(
          ctx,
          session.accessToken,
          encryptionKey,
        );
        if (session.idToken) {
          session.idToken = await encryptCookie(ctx, session.idToken, encryptionKey);
        }
        if (session.refreshToken) {
          session.refreshToken = await encryptCookie(
            ctx,
            session.refreshToken,
            encryptionKey,
          );
        }
      }

      const Session = await getSessionEntity();
      const result = await proteus.repository(Session).upsert(session);
      return result.id;
    },

    get: async (ctx, id): Promise<IPylonSession | null> => {
      const proteus = openSession(ctx, source);

      const Session = await getSessionEntity();
      const session = await proteus.repository(Session).findOne({ id });

      if (!session) return null;

      // No selector on the read side: the ciphertext names its own key, so aegis
      // resolves it by kid. Sessions written before this deployment changed
      // which key it encrypts with still decrypt.
      if (ctx.amphora.canDecrypt()) {
        if (AesKit.isAesString(session.accessToken)) {
          session.accessToken = await ctx.aegis.aes.decrypt(session.accessToken);
        }
        if (AesKit.isAesString(session.idToken)) {
          session.idToken = await ctx.aegis.aes.decrypt(session.idToken);
        }
        if (AesKit.isAesString(session.refreshToken)) {
          session.refreshToken = await ctx.aegis.aes.decrypt(session.refreshToken);
        }
      }

      return session;
    },

    del: async (ctx, id): Promise<void> => {
      const proteus = openSession(ctx, source);

      const Session = await getSessionEntity();
      await proteus.repository(Session).delete({ id });
    },

    logout: async (ctx, subject): Promise<void> => {
      const proteus = openSession(ctx, source);

      const Session = await getSessionEntity();
      await proteus.repository(Session).delete({ subject });
    },
  };
};
