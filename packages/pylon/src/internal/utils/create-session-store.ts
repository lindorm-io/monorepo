import { AesKit } from "@lindorm/aes";
import { LindormError, ServerError } from "@lindorm/errors";
import {
  MnemosSessionEntity,
  MongoSessionEntity,
  RedisSessionEntity,
} from "../../entities";
import { IPylonSession } from "../../interfaces";
import { IPylonSessionStore } from "../../interfaces/PylonSessionStore";
import {
  PylonCommonContext,
  PylonEntityRepository,
  PylonSessionOptions,
  PylonSource,
  PylonStoredSessionOptions,
} from "../../types";
import { getSource } from "./get-source";

export const addSessionEntities = (
  options: PylonStoredSessionOptions,
  sources: Map<string, PylonSource>,
): void => {
  const source = getSource(sources, options.source);

  switch (source.__instanceof) {
    case "MnemosSource":
      source.addEntities([MnemosSessionEntity]);
      break;

    case "MongoSource":
      source.addEntities([MongoSessionEntity]);
      break;

    case "RedisSource":
      source.addEntities([MongoSessionEntity]);
      break;

    default:
      break;
  }
};

const repository = (
  ctx: PylonCommonContext,
  options: PylonStoredSessionOptions,
): PylonEntityRepository<IPylonSession> => {
  switch (options.source) {
    case "MnemosSource":
      if (!ctx.mnemos?.source) {
        throw new ServerError("MnemosSource is not configured");
      }
      return ctx.mnemos.source.repository(MnemosSessionEntity);

    case "MongoSource":
      if (!ctx.mongo?.source) {
        throw new ServerError("MongoSource is not configured");
      }
      return ctx.mongo.source.repository(MongoSessionEntity);

    case "RedisSource":
      if (!ctx.redis?.source) {
        throw new ServerError("RedisSource is not configured");
      }
      return ctx.redis.source.repository(RedisSessionEntity);

    default:
      throw new LindormError("Unsupported source type");
  }
};

export const createSessionStore = (
  options?: PylonSessionOptions,
): IPylonSessionStore | undefined => {
  switch (options?.use) {
    case "custom":
      return options.custom;

    case "stored":
      return {
        set: async (ctx, session): Promise<string> => {
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

          const result = await repository(ctx, options).insert(session);

          return result.id;
        },

        get: async (ctx, id): Promise<IPylonSession | null> => {
          const session = await repository(ctx, options).findOne({ id });

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
          await repository(ctx, options).delete({ id });
        },

        logout: async (ctx, subject): Promise<void> => {
          await repository(ctx, options).delete({ subject });
        },
      };

    default:
      return;
  }
};
