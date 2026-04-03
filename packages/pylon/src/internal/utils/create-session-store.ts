import { AesKit } from "@lindorm/aes";
import { IProteusRepository } from "@lindorm/proteus";
import { SessionEntity } from "../../entities";
import { IPylonSession } from "../../interfaces";
import { IPylonSessionStore } from "../../interfaces/PylonSessionStore";
import { PylonCommonContext, PylonSessionOptions } from "../../types";

const getRepository = (
  ctx: PylonCommonContext,
  options: PylonSessionOptions,
): IProteusRepository<SessionEntity> | null => {
  if (options.proteus) {
    return options.proteus.clone({ logger: ctx.logger }).repository(SessionEntity);
  }
  if (ctx.proteus) {
    return ctx.proteus.repository(SessionEntity);
  }
  return null;
};

export const createSessionStore = (
  options?: PylonSessionOptions,
): IPylonSessionStore | undefined => {
  if (!options?.enabled) return;

  return {
    set: async (ctx, session): Promise<string> => {
      const repo = getRepository(ctx, options);
      if (!repo) return session.id;

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

      const result = await repo.insert(session);
      return result.id;
    },

    get: async (ctx, id): Promise<IPylonSession | null> => {
      const repo = getRepository(ctx, options);
      if (!repo) return null;

      const session = await repo.findOne({ id });

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
      const repo = getRepository(ctx, options);
      if (!repo) return;

      await repo.delete({ id });
    },

    logout: async (ctx, subject): Promise<void> => {
      const repo = getRepository(ctx, options);
      if (!repo) return;

      await repo.delete({ subject });
    },
  };
};
