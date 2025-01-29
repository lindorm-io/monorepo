import { MONGO_ENTITY_CONFIG, MongoEntity } from "../../classes";
import { ValidateMongoEntityFn } from "../../types";

export type TestEntityOneOptions = {
  email?: string;
  name: string;
};

export class TestEntityOne extends MongoEntity {
  public readonly email!: string | null;
  public readonly name!: string;
}

export const config = MONGO_ENTITY_CONFIG;

export const validate: ValidateMongoEntityFn<TestEntityOne> = (entity) => {
  if (!entity.email) {
    throw new Error("Missing email");
  }

  if (!entity.name) {
    throw new Error("Missing name");
  }
};
