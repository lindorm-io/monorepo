import Joi from "joi";
import { JOI_GUID, JOI_PHONE_NUMBER } from "../common";
import {
  EntityAttributes,
  EntityKeys,
  JOI_ENTITY_BASE,
  LindormEntity,
  Optional,
} from "@lindorm-io/entity";

export interface PhoneNumberAttributes extends EntityAttributes {
  identityId: string;
  phoneNumber: string;
  primary: boolean;
  verified: boolean;
}

export type PhoneNumberOptions = Optional<PhoneNumberAttributes, EntityKeys>;

const schema = Joi.object<PhoneNumberAttributes>({
  ...JOI_ENTITY_BASE,

  identityId: JOI_GUID.required(),
  phoneNumber: JOI_PHONE_NUMBER.required(),
  primary: Joi.boolean().required(),
  verified: Joi.boolean().required(),
});

export class PhoneNumber extends LindormEntity<PhoneNumberAttributes> {
  public readonly identityId: string;
  public readonly phoneNumber: string;

  public primary: boolean;
  public verified: boolean;

  public constructor(options: PhoneNumberOptions) {
    super(options);

    this.identityId = options.identityId;
    this.phoneNumber = options.phoneNumber;
    this.primary = options.primary;
    this.verified = options.verified;
  }

  public async schemaValidation(): Promise<void> {
    await schema.validateAsync(this.toJSON());
  }

  public toJSON(): PhoneNumberAttributes {
    return {
      ...this.defaultJSON(),

      identityId: this.identityId,
      phoneNumber: this.phoneNumber,
      primary: this.primary,
      verified: this.verified,
    };
  }
}
