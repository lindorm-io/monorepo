import { MnemosEntityBase } from "../../classes";
import { ValidateMnemosEntityFn } from "../../types";

export type TestEntityOneOptions = {
  email?: string;
  name: string;
};

export class TestEntityOne extends MnemosEntityBase {
  public readonly email!: string | null;
  public readonly name!: string;
}

export const validate: ValidateMnemosEntityFn<TestEntityOne> = (entity) => {
  if (!entity.email) {
    throw new Error("Missing email");
  }

  if (!entity.name) {
    throw new Error("Missing name");
  }
};
