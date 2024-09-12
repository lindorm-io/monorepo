import { RedisEntityBase } from "../../classes";
import { ValidateRedisEntityFn } from "../../types";

export type TestEntityOneOptions = {
  email?: string;
  name: string;
};

export class TestEntityOne extends RedisEntityBase {
  public readonly email: string | null;
  public readonly name: string;

  public constructor(options: TestEntityOneOptions) {
    super();

    this.email = options.email ?? null;
    this.name = options.name;
  }
}

export const validate: ValidateRedisEntityFn<TestEntityOne> = (entity) => {
  if (!entity.email) {
    throw new Error("Missing email");
  }

  if (!entity.name) {
    throw new Error("Missing name");
  }
};
