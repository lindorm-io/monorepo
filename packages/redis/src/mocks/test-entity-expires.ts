import Joi from "joi";
import {
  EntityAttributes,
  EntityKeys,
  JOI_ENTITY_BASE,
  LindormEntity,
  Optional,
} from "@lindorm-io/entity";

export interface TestEntityExpiresAttributes extends EntityAttributes {
  name: string;
  expires: Date | null;
}

type TestEntityExpiresOptions = Optional<TestEntityExpiresAttributes, EntityKeys | "name">;

const schema = Joi.object({
  ...JOI_ENTITY_BASE,
  name: Joi.string().allow(null).required(),
  expires: Joi.date().allow(null).required(),
});

export class TestEntityExpires extends LindormEntity<TestEntityExpiresAttributes> {
  public name: string;
  public expires: Date | null;

  public constructor(options: TestEntityExpiresOptions) {
    super(options);
    this.name = options.name || null;
    this.expires = options.expires || null;
  }

  public async schemaValidation(): Promise<void> {
    return await schema.validateAsync(this.toJSON());
  }

  public toJSON(): TestEntityExpiresAttributes {
    return {
      ...this.defaultJSON(),
      name: this.name,
      expires: this.expires,
    };
  }
}
