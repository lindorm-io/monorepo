import { AesKit } from "@lindorm/aes";
import { ServerError } from "@lindorm/errors";
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

/**
 * Decrypt one stored session token.
 *
 * There is deliberately NO capability pre-check in front of this. `get` used to
 * gate the whole decrypt block on `amphora.canDecrypt()`, which asked a question
 * the decrypt never asks — and answered it wrongly: it ran amphora's default
 * publish gate, so an INTERNAL unpublished KEK (`purpose: "pylon:kek"`,
 * `publish: false` — the shape the docs and the scaffold configure) made it
 * answer `false`, the block was skipped, and `get` handed the CIPHERTEXT back as
 * the session's access token. It reached the IdP as a bearer token.
 *
 * So a key this deployment no longer holds is a THROW. Returning the ciphertext
 * untouched is the worst available outcome — it is a bearer token that is not
 * one, and every consumer downstream treats it as valid until a remote endpoint
 * rejects it with no explanation.
 */
const decryptSessionToken = async (
  ctx: PylonCommonContext,
  value: string,
  field: string,
  id: string,
): Promise<string> => {
  try {
    // No selector: the ciphertext names its own key, so aegis resolves it by
    // kid. Sessions written before this deployment changed which key it
    // encrypts with still decrypt.
    return await ctx.aegis.aes.decrypt(value);
  } catch (error: any) {
    const { keyId } = AesKit.parse(value);

    throw new ServerError("Stored session is sealed with an unavailable key", {
      code: "session_decryption_failed",
      type: "urn:lindorm:pylon:error:session_decryption_failed",
      title: "Stored Session Is Sealed With An Unavailable Key",
      details: `The stored session's ${field} is sealed with key "${keyId}", which this deployment cannot resolve. Session encryption at rest is readable only with the key the ciphertext names — restore that key to the vault, or evict the session. The ciphertext is never handed back as a token.`,
      data: { id, field, kid: keyId },
      error,
    });
  }
};

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
      // turns it on, and a NAMED key that cannot be resolved throws rather than
      // persisting a bearer token in the clear. There is deliberately no
      // capability fallback for an UNNAMED key — falling back to "encrypt with
      // whatever the vault offers" resolves through aegis's deployment-wide enc
      // policy and seals the session with the JWKS token key. Unnamed ⇒ stored
      // as-is, never guessed. (The READ side needs no such decision: the
      // ciphertext names its own key — see `decryptSessionToken`.)
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

      // A sealed value is decrypted because it IS sealed — the shape of the
      // stored value is the whole trigger, and it names the key that reads it.
      if (AesKit.isAesString(session.accessToken)) {
        session.accessToken = await decryptSessionToken(
          ctx,
          session.accessToken,
          "accessToken",
          id,
        );
      }
      if (AesKit.isAesString(session.idToken)) {
        session.idToken = await decryptSessionToken(ctx, session.idToken, "idToken", id);
      }
      if (AesKit.isAesString(session.refreshToken)) {
        session.refreshToken = await decryptSessionToken(
          ctx,
          session.refreshToken,
          "refreshToken",
          id,
        );
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
