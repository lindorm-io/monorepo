import Joi from "joi";
import {
  EntityAttributes,
  EntityKeys,
  JOI_ENTITY_BASE,
  LindormEntity,
  Optional,
} from "@lindorm-io/entity";

export type AccountAttributes = EntityAttributes & {
  browserLinkCode: string | null;
  password: string | null;
  recoveryCode: string | null;
  requireMfa: boolean;
  totp: string | null;
};

export type AccountOptions = Optional<
  AccountAttributes,
  EntityKeys | "browserLinkCode" | "password" | "recoveryCode" | "requireMfa" | "totp"
>;

const schema = Joi.object<AccountAttributes>({
  ...JOI_ENTITY_BASE,

  browserLinkCode: Joi.string().allow(null).required(),
  password: Joi.string().allow(null).required(),
  recoveryCode: Joi.string().allow(null).required(),
  requireMfa: Joi.boolean().required(),
  totp: Joi.string().allow(null).required(),
});

export class Account extends LindormEntity<AccountAttributes> implements AccountAttributes {
  public browserLinkCode: string | null;
  public password: string | null;
  public recoveryCode: string | null;
  public requireMfa: boolean;
  public totp: string | null;

  public constructor(options: AccountOptions) {
    super(options);

    this.browserLinkCode = options.browserLinkCode || null;
    this.password = options.password || null;
    this.recoveryCode = options.recoveryCode || null;
    this.requireMfa = options.requireMfa === true;
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
      requireMfa: this.requireMfa,
      totp: this.totp,
    };
  }
}
