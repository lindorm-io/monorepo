import { REDIS_ENTITY_CONFIG, RedisEntity } from "../../classes";
import { ValidateRedisEntityFn } from "../../types";

export type TestEntityOneOptions = {
  email?: string;
  name: string;
};

export class TestEntityOne extends RedisEntity {
  public readonly email!: string | null;
  public readonly name!: string;
  public readonly ttlAt!: Date | null;
}

export const config = REDIS_ENTITY_CONFIG;

export const validate: ValidateRedisEntityFn<TestEntityOne> = (entity) => {
  if (!entity.email) {
    throw new Error("Missing email");
  }

  if (!entity.name) {
    throw new Error("Missing name");
  }
};
