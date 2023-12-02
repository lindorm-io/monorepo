import {
  EntityAttributes,
  EntityKeys,
  JOI_ENTITY_BASE,
  LindormEntity,
  Optional,
} from "@lindorm-io/entity";
import Joi from "joi";

export type EncryptionKeyAttributes = EntityAttributes & {
  key: string;
  owner: string;
  ownerType: string;
};

export type EncryptionKeyOptions = Optional<EncryptionKeyAttributes, EntityKeys>;

const schema = Joi.object<EncryptionKeyAttributes>({
  ...JOI_ENTITY_BASE,

  key: Joi.string().base64().required(),
  owner: Joi.string().guid().required(),
  ownerType: Joi.string().required(),
});

export class EncryptionKey extends LindormEntity<EncryptionKeyAttributes> {
  public readonly key: string;
  public readonly owner: string;
  public readonly ownerType: string;

  public constructor(options: EncryptionKeyOptions) {
    super(options);

    this.key = options.key;
    this.owner = options.owner;
    this.ownerType = options.ownerType;
  }

  public async schemaValidation(): Promise<void> {
    await schema.validateAsync(this.toJSON());
  }

  public toJSON(): EncryptionKeyAttributes {
    return {
      ...this.defaultJSON(),

      key: this.key,
      owner: this.owner,
      ownerType: this.ownerType,
    };
  }
}
