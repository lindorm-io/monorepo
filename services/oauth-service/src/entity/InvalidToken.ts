import Joi from "joi";
import {
  EntityAttributes,
  EntityKeys,
  JOI_ENTITY_BASE,
  LindormEntity,
  Optional,
} from "@lindorm-io/entity";

export type InvalidTokenAttributes = EntityAttributes & {
  expires: Date;
};

export type InvalidTokenOptions = Optional<InvalidTokenAttributes, EntityKeys>;

const schema = Joi.object<InvalidTokenAttributes>()
  .keys({
    ...JOI_ENTITY_BASE,

    expires: Joi.date().required(),
  })
  .required();

export class InvalidToken extends LindormEntity<InvalidTokenAttributes> {
  public readonly expires: Date;

  public constructor(options: InvalidTokenOptions) {
    super(options);

    this.expires = options.expires;
  }

  public async schemaValidation(): Promise<void> {
    await schema.validateAsync(this.toJSON());
  }

  public toJSON(): InvalidTokenAttributes {
    return {
      ...this.defaultJSON(),

      expires: this.expires,
    };
  }
}
