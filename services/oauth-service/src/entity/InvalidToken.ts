import Joi from "joi";
import {
  EntityAttributes,
  EntityKeys,
  JOI_ENTITY_BASE,
  LindormEntity,
  Optional,
} from "@lindorm-io/entity";

export type InvalidTokenAttributes = EntityAttributes;

export type InvalidTokenOptions = Optional<InvalidTokenAttributes, EntityKeys>;

const schema = Joi.object<InvalidTokenAttributes>()
  .keys({
    ...JOI_ENTITY_BASE,
  })
  .required();

export class InvalidToken extends LindormEntity<InvalidTokenAttributes> {
  public constructor(options: InvalidTokenOptions) {
    super(options);
  }

  public async schemaValidation(): Promise<void> {
    await schema.validateAsync(this.toJSON());
  }

  public toJSON(): InvalidTokenAttributes {
    return {
      ...this.defaultJSON(),
    };
  }
}
