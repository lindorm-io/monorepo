import { ILogger } from "@lindorm/logger";
import { Constructor } from "@lindorm/types";
import { Redis } from "ioredis";
import { IRedisEntity } from "../interfaces";

export type ValidateRedisEntityFn<E extends IRedisEntity = IRedisEntity> = (
  entity: Omit<
    E,
    "id" | "revision" | "createdAt" | "updatedAt" | "deletedAt" | "expiresAt"
  >,
) => void;

export type RedisRepositoryOptions<E extends IRedisEntity> = {
  Entity: Constructor<E>;
  client: Redis;
  logger: ILogger;
  namespace?: string;
  validate?: ValidateRedisEntityFn<E>;
};
