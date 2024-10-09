import { IEntity } from "@lindorm/entity";
import { ILogger } from "@lindorm/logger";
import { Constructor, DeepPartial } from "@lindorm/types";
import { Redis } from "ioredis";

export type CreateRedisEntityFn<E extends IEntity = IEntity> = (
  options: DeepPartial<E>,
) => E;

export type ValidateRedisEntityFn<E extends IEntity = IEntity> = (
  entity: Omit<
    E,
    "id" | "rev" | "seq" | "createdAt" | "updatedAt" | "deletedAt" | "expiresAt"
  >,
) => void;

export type RedisRepositoryOptions<E extends IEntity> = {
  Entity: Constructor<E>;
  client: Redis;
  logger: ILogger;
  namespace?: string;
  create?: CreateRedisEntityFn<E>;
  validate?: ValidateRedisEntityFn<E>;
};
