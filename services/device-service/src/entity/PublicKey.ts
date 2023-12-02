import {
  EntityAttributes,
  EntityKeys,
  JOI_ENTITY_BASE,
  LindormEntity,
  Optional,
} from "@lindorm-io/entity";
import Joi from "joi";

export interface PublicKeyAttributes extends EntityAttributes {
  key: string;
}

export type PublicKeyOptions = Optional<PublicKeyAttributes, EntityKeys>;

const schema = Joi.object<PublicKeyAttributes>()
  .keys({
    ...JOI_ENTITY_BASE,

    key: Joi.string().required(),
  })
  .required();

export class PublicKey extends LindormEntity<PublicKeyAttributes> {
  public readonly key: string;

  public constructor(options: PublicKeyOptions) {
    super(options);

    this.key = options.key;
  }

  public async schemaValidation(): Promise<void> {
    await schema.validateAsync(this.toJSON());
  }

  public toJSON(): PublicKeyAttributes {
    return {
      ...this.defaultJSON(),

      key: this.key,
    };
  }
}
