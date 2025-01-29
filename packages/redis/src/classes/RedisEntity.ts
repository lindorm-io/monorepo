import { EntityBase } from "@lindorm/entity";
import { IRedisEntity } from "../interfaces";
import { RedisEntityConfig } from "../types";

export class RedisEntity extends EntityBase implements IRedisEntity {
  public expiresAt!: Date | null;
}

export const REDIS_ENTITY_CONFIG: RedisEntityConfig<RedisEntity> = {
  ttlAttribute: "expiresAt",
};
