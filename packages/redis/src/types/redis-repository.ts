import { ILogger } from "@lindorm/logger";
import { Constructor, DeepPartial } from "@lindorm/types";
import { Redis } from "ioredis";
import { IRedisEntity } from "../interfaces";

export type CreateRedisEntityFn<E extends IRedisEntity = IRedisEntity> = (
  options: DeepPartial<E>,
) => E;

export type ValidateRedisEntityFn<E extends IRedisEntity = IRedisEntity> = (
  entity: Omit<E, "id" | "createdAt" | "updatedAt" | "expiresAt">,
) => void;

export type RedisRepositoryOptions<E extends IRedisEntity> = {
  Entity: Constructor<E>;
  client: Redis;
  logger: ILogger;
  namespace?: string;
  create?: CreateRedisEntityFn<E>;
  validate?: ValidateRedisEntityFn<E>;
};
