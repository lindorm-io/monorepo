import Joi from "joi";
import {
  EntityAttributes,
  EntityKeys,
  ILindormEntity,
  JOI_ENTITY_BASE,
  LindormEntity,
  Optional,
} from "@lindorm-io/entity";

export interface TestEntityAttributes extends EntityAttributes {
  name: string;
}

export type TestEntityOptions = Optional<TestEntityAttributes, EntityKeys | "name">;

export const schema = Joi.object({
  ...JOI_ENTITY_BASE,
  name: Joi.string().required(),
});

export class TestEntity
  extends LindormEntity<TestEntityAttributes>
  implements ILindormEntity<TestEntityAttributes>
{
  public name: string;

  public constructor(options: TestEntityOptions) {
    super(options);
    this.name = options.name || "name";
  }

  public async schemaValidation(): Promise<void> {
    await schema.validateAsync(this.toJSON());
  }

  public toJSON(): TestEntityAttributes {
    return {
      ...this.defaultJSON(),
      name: this.name,
    };
  }
}
