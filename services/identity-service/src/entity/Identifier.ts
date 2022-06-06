import Joi from "joi";
import { IdentifierType, JOI_GUID } from "../common";
import {
  EntityAttributes,
  EntityKeys,
  JOI_ENTITY_BASE,
  LindormEntity,
  Optional,
} from "@lindorm-io/entity";

export interface IdentifierAttributes extends EntityAttributes {
  identifier: string;
  identityId: string;
  label: string | null;
  primary: boolean;
  provider: string;
  type: IdentifierType;
  verified: boolean;
}

export type IdentifierOptions = Optional<IdentifierAttributes, EntityKeys | "label">;

const schema = Joi.object<IdentifierAttributes>()
  .keys({
    ...JOI_ENTITY_BASE,

    identifier: Joi.string().required(),
    identityId: JOI_GUID.required(),
    label: Joi.string().allow(null).required(),
    primary: Joi.boolean().required(),
    provider: Joi.string().required(),
    type: Joi.string().required(),
    verified: Joi.boolean().required(),
  })
  .required();

export class Identifier extends LindormEntity<IdentifierAttributes> {
  public readonly identifier: string;
  public readonly identityId: string;
  public readonly provider: string;
  public readonly type: IdentifierType;

  public label: string | null;
  public primary: boolean;
  public verified: boolean;

  public constructor(options: IdentifierOptions) {
    super(options);

    this.identifier = options.identifier;
    this.identityId = options.identityId;
    this.label = options.label || null;
    this.primary = options.primary;
    this.provider = options.provider;
    this.type = options.type;
    this.verified = options.verified;
  }

  public async schemaValidation(): Promise<void> {
    await schema.validateAsync(this.toJSON());
  }

  public toJSON(): IdentifierAttributes {
    return {
      ...this.defaultJSON(),

      identifier: this.identifier,
      identityId: this.identityId,
      label: this.label,
      primary: this.primary,
      provider: this.provider,
      type: this.type,
      verified: this.verified,
    };
  }
}
