import Joi from "joi";
import {
  EntityAttributes,
  EntityKeys,
  JOI_ENTITY_BASE,
  LindormEntity,
  Optional,
} from "@lindorm-io/entity";

export interface EncryptedRecordAttributes extends EntityAttributes {
  expires: Date | null;
  encryptedData: string;
}

export type EncryptedRecordOptions = Optional<EncryptedRecordAttributes, EntityKeys | "expires">;
const schema = Joi.object<EncryptedRecordAttributes>({
  ...JOI_ENTITY_BASE,

  expires: Joi.date().allow(null).required(),
  encryptedData: Joi.string().required(),
});

export class EncryptedRecord extends LindormEntity<EncryptedRecordAttributes> {
  public readonly expires: Date | null;
  public readonly encryptedData: string;

  public constructor(options: EncryptedRecordOptions) {
    super(options);

    this.expires = options.expires || null;
    this.encryptedData = options.encryptedData;
  }

  public async schemaValidation(): Promise<void> {
    await schema.validateAsync(this.toJSON());
  }

  public toJSON(): EncryptedRecordAttributes {
    return {
      ...this.defaultJSON(),

      expires: this.expires,
      encryptedData: this.encryptedData,
    };
  }
}
