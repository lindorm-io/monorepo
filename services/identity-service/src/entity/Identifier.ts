import { IdentifierType } from "@lindorm-io/common-enums";
import {
  EntityAttributes,
  EntityKeys,
  JOI_ENTITY_BASE,
  LindormEntity,
  Optional,
} from "@lindorm-io/entity";
import Joi from "joi";

export type IdentifierAttributes = EntityAttributes & {
  identityId: string;
  label: string | null;
  primary: boolean;
  provider: string;
  type: IdentifierType;
  value: string;
  verified: boolean;
};

export type IdentifierOptions = Optional<IdentifierAttributes, EntityKeys | "label">;

const schema = Joi.object<IdentifierAttributes>()
  .keys({
    ...JOI_ENTITY_BASE,

    identityId: Joi.string().guid().required(),
    label: Joi.string().allow(null).required(),
    primary: Joi.boolean().required(),
    provider: Joi.string().required(),
    type: Joi.string()
      .valid(...Object.values(IdentifierType))
      .required(),
    value: Joi.string().required(),
    verified: Joi.boolean().required(),
  })
  .required();

export class Identifier extends LindormEntity<IdentifierAttributes> {
  public readonly identityId: string;
  public readonly provider: string;
  public readonly type: IdentifierType;
  public readonly value: string;

  public label: string | null;
  public primary: boolean;
  public verified: boolean;

  public constructor(options: IdentifierOptions) {
    super(options);

    this.identityId = options.identityId;
    this.label = options.label || null;
    this.primary = options.primary;
    this.provider = options.provider;
    this.type = options.type;
    this.value = options.value;
    this.verified = options.verified;
  }

  public async schemaValidation(): Promise<void> {
    await schema.validateAsync(this.toJSON());
  }

  public toJSON(): IdentifierAttributes {
    return {
      ...this.defaultJSON(),

      identityId: this.identityId,
      label: this.label,
      primary: this.primary,
      provider: this.provider,
      type: this.type,
      value: this.value,
      verified: this.verified,
    };
  }
}
