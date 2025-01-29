import { MNEMOS_ENTITY_CONFIG, MnemosEntity } from "../../classes";
import { ValidateMnemosEntityFn } from "../../types";

export type TestEntityOneOptions = {
  email?: string;
  name: string;
};

export class TestEntityOne extends MnemosEntity {
  public readonly email!: string | null;
  public readonly name!: string;
}

export const config = MNEMOS_ENTITY_CONFIG;

export const validate: ValidateMnemosEntityFn<TestEntityOne> = (entity) => {
  if (!entity.email) {
    throw new Error("Missing email");
  }

  if (!entity.name) {
    throw new Error("Missing name");
  }
};
