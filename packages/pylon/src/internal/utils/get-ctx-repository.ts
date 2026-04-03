import { IEntity } from "@lindorm/entity";
import { ServerError } from "@lindorm/errors";
import { Constructor } from "@lindorm/types";
import {
  PylonCommonContext,
  PylonEntityRepository,
  PylonEntitySourceName,
} from "../../types";
import { findEntitySource } from "./find-entity-source";

type Options = {
  source?: PylonEntitySourceName;
};

export const getCtxRepository = <C extends PylonCommonContext, E extends IEntity>(
  ctx: C,
  target: Constructor<E>,
  options: Options,
): PylonEntityRepository<E> => {
  const source = findEntitySource(ctx, target, options);

  switch (source) {
    case "MnemosSource":
      if (!ctx.mnemos?.source) {
        throw new ServerError("MnemosSource is not configured");
      }
      return ctx.mnemos.source.repository(target);

    case "MongoSource":
      if (!ctx.mongo?.source) {
        throw new ServerError("MongoSource is not configured");
      }
      return ctx.mongo.source.repository(target);

    case "RedisSource":
      if (!ctx.redis?.source) {
        throw new ServerError("RedisSource is not configured");
      }
      return ctx.redis.source.repository(target);

    default:
      throw new ServerError("Unsupported source type");
  }
};
