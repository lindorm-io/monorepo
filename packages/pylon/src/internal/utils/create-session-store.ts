import { AesKit } from "@lindorm/aes";
import type { IProteusSession, IProteusSource } from "@lindorm/proteus";
import type { IPylonSession } from "../../interfaces/index.js";
import type { IPylonSessionStore } from "../../interfaces/PylonSessionStore.js";
import type {
  PylonCommonContext,
  PylonKeys,
  PylonSessionOptions,
} from "../../types/index.js";
import { buildHookMeta } from "./build-hook-meta.js";
import { resolveSessionKeys } from "./keys/resolve-session-keys.js";
import { resolveActor } from "./resolve-actor.js";

const getSource = (
  ctx: PylonCommonContext,
  override?: IProteusSource,
): IProteusSession | null => {
  if (override) {
    return override.session({
      logger: ctx.logger,
      meta: buildHookMeta(ctx, resolveActor(ctx)),
    });
  }
  return ctx.kv ?? null;
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
  options?: PylonSessionOptions,
  keys?: PylonKeys,
): IPylonSessionStore | undefined => {
  if (!options?.enabled) return;

  // Same key that seals the session COOKIE: `session.encryption ?? cookie.encryption`.
  // A stored session and a cookie-only session are the same secret in two
  // places — the store just holds it at rest instead of on the wire.
  const { encryption: encryptionKey } = resolveSessionKeys(keys);

  return {
    set: async (ctx, session): Promise<string> => {
      const source = getSource(ctx, options.kv);
      if (!source) return session.id;

      // A named key makes encryption MANDATORY — if it cannot be resolved, aegis
      // throws rather than persisting a bearer token in the clear. Without one,
      // the vault's capability decides, as before. The selector scopes the write
      // to the internal session enc key; without it aegis's deployment-wide enc
      // policy queries the PUBLISHED set and seals the session with the JWKS
      // token key instead.
      if (encryptionKey || ctx.amphora.canEncrypt()) {
        session.accessToken = await ctx.aegis.aes.encrypt(
          session.accessToken,
          "tokenised",
          encryptionKey,
        );
        if (session.idToken) {
          session.idToken = await ctx.aegis.aes.encrypt(
            session.idToken,
            "tokenised",
            encryptionKey,
          );
        }
        if (session.refreshToken) {
          session.refreshToken = await ctx.aegis.aes.encrypt(
            session.refreshToken,
            "tokenised",
            encryptionKey,
          );
        }
      }

      const Session = await getSessionEntity();
      const result = await source.repository(Session).upsert(session);
      return result.id;
    },

    get: async (ctx, id): Promise<IPylonSession | null> => {
      const source = getSource(ctx, options.kv);
      if (!source) return null;

      const Session = await getSessionEntity();
      const session = await source.repository(Session).findOne({ id });

      if (!session) return null;

      // No selector on the read side: the ciphertext names its own key, so aegis
      // resolves it by kid. Sessions written before this deployment changed
      // which key it encrypts with still decrypt.
      if (ctx.amphora.canDecrypt()) {
        if (AesKit.isAesTokenised(session.accessToken)) {
          session.accessToken = await ctx.aegis.aes.decrypt(session.accessToken);
        }
        if (AesKit.isAesTokenised(session.idToken)) {
          session.idToken = await ctx.aegis.aes.decrypt(session.idToken);
        }
        if (AesKit.isAesTokenised(session.refreshToken)) {
          session.refreshToken = await ctx.aegis.aes.decrypt(session.refreshToken);
        }
      }

      return session;
    },

    del: async (ctx, id): Promise<void> => {
      const source = getSource(ctx, options.kv);
      if (!source) return;

      const Session = await getSessionEntity();
      await source.repository(Session).delete({ id });
    },

    logout: async (ctx, subject): Promise<void> => {
      const source = getSource(ctx, options.kv);
      if (!source) return;

      const Session = await getSessionEntity();
      await source.repository(Session).delete({ subject });
    },
  };
};
