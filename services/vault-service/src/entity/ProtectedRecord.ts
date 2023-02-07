import Joi from "joi";
import {
  EntityAttributes,
  EntityKeys,
  JOI_ENTITY_BASE,
  LindormEntity,
  Optional,
} from "@lindorm-io/entity";

export type ProtectedRecordAttributes = EntityAttributes & {
  expires: Date | null;
  owner: string;
  ownerType: string;
  protectedData: string;
};

export type ProtectedRecordOptions = Optional<ProtectedRecordAttributes, EntityKeys | "expires">;

const schema = Joi.object<ProtectedRecordAttributes>({
  ...JOI_ENTITY_BASE,

  expires: Joi.date().allow(null).required(),
  owner: Joi.string().guid().required(),
  ownerType: Joi.string().required(),
  protectedData: Joi.string().required(),
});

export class ProtectedRecord extends LindormEntity<ProtectedRecordAttributes> {
  public readonly expires: Date | null;
  public readonly owner: string;
  public readonly ownerType: string;
  public readonly protectedData: string;

  public constructor(options: ProtectedRecordOptions) {
    super(options);

    this.expires = options.expires || null;
    this.owner = options.owner;
    this.ownerType = options.ownerType;
    this.protectedData = options.protectedData;
  }

  public async schemaValidation(): Promise<void> {
    await schema.validateAsync(this.toJSON());
  }

  public toJSON(): ProtectedRecordAttributes {
    return {
      ...this.defaultJSON(),

      expires: this.expires,
      owner: this.owner,
      ownerType: this.ownerType,
      protectedData: this.protectedData,
    };
  }
}
