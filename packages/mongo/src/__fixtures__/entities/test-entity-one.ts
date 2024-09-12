import { MongoEntityBase } from "../../classes";
import { ValidateMongoEntityFn } from "../../types";

export type TestEntityOneOptions = {
  email?: string;
  name: string;
};

export class TestEntityOne extends MongoEntityBase {
  public readonly email: string | null;
  public readonly name: string;

  public constructor(options: TestEntityOneOptions) {
    super();

    this.email = options.email ?? null;
    this.name = options.name;
  }
}

export const validate: ValidateMongoEntityFn<TestEntityOne> = (entity) => {
  if (!entity.email) {
    throw new Error("Missing email");
  }

  if (!entity.name) {
    throw new Error("Missing name");
  }
};
