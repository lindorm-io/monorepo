import Joi from "joi";
import {
  EntityAttributes,
  EntityKeys,
  JOI_ENTITY_BASE,
  LindormEntity,
  Optional,
} from "@lindorm-io/entity";

export interface AccountSalt {
  aes: string;
  sha: string;
}

export interface AccountAttributes extends EntityAttributes {
  browserLinkCode: string | null;
  password: string | null;
  recoveryCode: string | null;
  salt: AccountSalt;
  totp: string | null;
}

export type AccountOptions = Optional<
  AccountAttributes,
  EntityKeys | "browserLinkCode" | "password" | "recoveryCode" | "totp"
>;

const schema = Joi.object<AccountAttributes>({
  ...JOI_ENTITY_BASE,

  browserLinkCode: Joi.string().uppercase().allow(null).required(),
  password: Joi.string().base64().allow(null).required(),
  recoveryCode: Joi.string().base64().required(),
  salt: Joi.object({
    aes: Joi.string().length(128).required(),
    sha: Joi.string().length(128).required(),
  }).required(),
  totp: Joi.string().base64().allow(null).required(),
});

export class Account extends LindormEntity<AccountAttributes> implements AccountAttributes {
  public browserLinkCode: string | null;
  public password: string | null;
  public recoveryCode: string | null;
  public salt: AccountSalt;
  public totp: string | null;

  public constructor(options: AccountOptions) {
    super(options);

    this.browserLinkCode = options.browserLinkCode || null;
    this.password = options.password || null;
    this.recoveryCode = options.recoveryCode || null;
    this.salt = options.salt;
    this.totp = options.totp || null;
  }

  public create(): void {
    /* intentionally left empty */
  }

  public async schemaValidation(): Promise<void> {
    await schema.validateAsync(this.toJSON());
  }

  public toJSON(): AccountAttributes {
    return {
      ...this.defaultJSON(),

      browserLinkCode: this.browserLinkCode,
      password: this.password,
      recoveryCode: this.recoveryCode,
      salt: this.salt,
      totp: this.totp,
    };
  }
}
