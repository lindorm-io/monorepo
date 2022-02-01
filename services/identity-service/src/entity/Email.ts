import Joi from "joi";
import { JOI_EMAIL, JOI_GUID } from "../common";
import {
  EntityAttributes,
  EntityKeys,
  JOI_ENTITY_BASE,
  LindormEntity,
  Optional,
} from "@lindorm-io/entity";

export interface EmailAttributes extends EntityAttributes {
  email: string;
  identityId: string;
  primary: boolean;
  verified: boolean;
}

export type EmailOptions = Optional<EmailAttributes, EntityKeys>;

const schema = Joi.object<EmailAttributes>({
  ...JOI_ENTITY_BASE,

  email: JOI_EMAIL.required(),
  identityId: JOI_GUID.required(),
  primary: Joi.boolean().required(),
  verified: Joi.boolean().required(),
});

export class Email extends LindormEntity<EmailAttributes> {
  public readonly email: string;
  public readonly identityId: string;

  public primary: boolean;
  public verified: boolean;

  public constructor(options: EmailOptions) {
    super(options);

    this.email = options.email;
    this.identityId = options.identityId;
    this.primary = options.primary;
    this.verified = options.verified;
  }

  public async schemaValidation(): Promise<void> {
    await schema.validateAsync(this.toJSON());
  }

  public toJSON(): EmailAttributes {
    return {
      ...this.defaultJSON(),

      email: this.email,
      identityId: this.identityId,
      primary: this.primary,
      verified: this.verified,
    };
  }
}
