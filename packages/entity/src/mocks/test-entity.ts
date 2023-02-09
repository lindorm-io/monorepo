import Joi from "joi";
import { EntityAttributes, EntityKeys, Optional } from "../types";
import { JOI_ENTITY_BASE } from "../schema";
import { LindormEntity } from "../entity";

export interface TestEntityAttributes extends EntityAttributes {
  name: string;
}

type TestEntityOptions = Optional<TestEntityAttributes, EntityKeys | "name">;

const schema = Joi.object({
  ...JOI_ENTITY_BASE,
  name: Joi.string().allow(null).required(),
});

export class TestEntity extends LindormEntity<TestEntityAttributes> {
  public name: string;

  public constructor(options: TestEntityOptions = {}) {
    super(options);
    this.name = options.name || "name";
  }

  public async schemaValidation(): Promise<void> {
    return await schema.validateAsync(this.toJSON());
  }

  public toJSON() {
    return {
      ...this.defaultJSON(),
      name: this.name,
    };
  }
}
