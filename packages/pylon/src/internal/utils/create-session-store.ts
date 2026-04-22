import { AesKit } from "@lindorm/aes";
import type { IProteusSession, IProteusSource } from "@lindorm/proteus";
import { Session } from "../../entities/index.js";
import type { IPylonSession } from "../../interfaces/index.js";
import type { IPylonSessionStore } from "../../interfaces/PylonSessionStore.js";
import type { PylonCommonContext, PylonSessionOptions } from "../../types/index.js";
import { buildHookMeta } from "./build-hook-meta.js";

const getSource = (
  ctx: PylonCommonContext,
  override?: IProteusSource,
): IProteusSession | null => {
  if (override) {
    return override.session({ logger: ctx.logger, meta: buildHookMeta(ctx, null) });
  }
  return ctx.proteus ?? null;
};

export const createSessionStore = (
  options?: PylonSessionOptions,
): IPylonSessionStore | undefined => {
  if (!options?.enabled) return;

  return {
    set: async (ctx, session): Promise<string> => {
      const source = getSource(ctx, options.proteus);
      if (!source) return session.id;

      if (ctx.amphora.canEncrypt()) {
        session.accessToken = await ctx.aegis.aes.encrypt(
          session.accessToken,
          "tokenised",
        );
        if (session.idToken) {
          session.idToken = await ctx.aegis.aes.encrypt(session.idToken, "tokenised");
        }
        if (session.refreshToken) {
          session.refreshToken = await ctx.aegis.aes.encrypt(
            session.refreshToken,
            "tokenised",
          );
        }
      }

      const result = await source.repository(Session).upsert(session);
      return result.id;
    },

    get: async (ctx, id): Promise<IPylonSession | null> => {
      const source = getSource(ctx, options.proteus);
      if (!source) return null;

      const session = await source.repository(Session).findOne({ id });

      if (!session) return null;

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
      const source = getSource(ctx, options.proteus);
      if (!source) return;

      await source.repository(Session).delete({ id });
    },

    logout: async (ctx, subject): Promise<void> => {
      const source = getSource(ctx, options.proteus);
      if (!source) return;

      await source.repository(Session).delete({ subject });
    },
  };
};
