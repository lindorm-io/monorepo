import { AesKit } from "@lindorm/aes";
import { IProteusSource } from "@lindorm/proteus";
import { SessionEntity } from "../../entities";
import { IPylonSession } from "../../interfaces";
import { IPylonSessionStore } from "../../interfaces/PylonSessionStore";
import { PylonCommonContext, PylonSessionOptions } from "../../types";

const getSource = (
  ctx: PylonCommonContext,
  override?: IProteusSource,
): IProteusSource | null => {
  if (override) {
    return override.clone({ logger: ctx.logger });
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

      const result = await source.repository(SessionEntity).insert(session);
      return result.id;
    },

    get: async (ctx, id): Promise<IPylonSession | null> => {
      const source = getSource(ctx, options.proteus);
      if (!source) return null;

      const session = await source.repository(SessionEntity).findOne({ id });

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

      await source.repository(SessionEntity).delete({ id });
    },

    logout: async (ctx, subject): Promise<void> => {
      const source = getSource(ctx, options.proteus);
      if (!source) return;

      await source.repository(SessionEntity).delete({ subject });
    },
  };
};
