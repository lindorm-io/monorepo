import { RedisEntityBase } from "../../classes";
import { ValidateRedisEntityFn } from "../../types";

export type TestEntityOneOptions = {
  email?: string;
  name: string;
};

export class TestEntityOne extends RedisEntityBase {
  public readonly email!: string | null;
  public readonly name!: string;
}

export const validate: ValidateRedisEntityFn<TestEntityOne> = (entity) => {
  if (!entity.email) {
    throw new Error("Missing email");
  }

  if (!entity.name) {
    throw new Error("Missing name");
  }
};
