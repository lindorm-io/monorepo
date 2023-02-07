import Joi from "joi";
import { JOI_AUTHENTICATION_STRATEGY } from "../constant";
import { JOI_EMAIL, JOI_PHONE_NUMBER, JOI_SESSION_STATUS } from "../common";
import { AuthenticationStrategy, SessionStatus, SessionStatuses } from "@lindorm-io/common-types";
import {
  EntityAttributes,
  EntityKeys,
  JOI_ENTITY_BASE,
  LindormEntity,
  Optional,
} from "@lindorm-io/entity";

export type StrategySessionAttributes = EntityAttributes & {
  authenticationSessionId: string;
  code: string | null;
  email: string | null;
  expires: Date;
  strategy: AuthenticationStrategy;
  nin: string | null;
  nonce: string | null;
  otp: string | null;
  phoneNumber: string | null;
  status: SessionStatus;
  username: string | null;
};

export type StrategySessionOptions = Optional<
  StrategySessionAttributes,
  EntityKeys | "code" | "email" | "nin" | "nonce" | "otp" | "phoneNumber" | "status" | "username"
>;

const schema = Joi.object<StrategySessionAttributes>()
  .keys({
    ...JOI_ENTITY_BASE,

    authenticationSessionId: Joi.string().guid().required(),
    code: Joi.string().allow(null).required(),
    email: JOI_EMAIL.allow(null).required(),
    expires: Joi.date().required(),
    strategy: JOI_AUTHENTICATION_STRATEGY.required(),
    nin: Joi.string().allow(null).required(),
    nonce: Joi.string().allow(null).required(),
    otp: Joi.string().allow(null).required(),
    phoneNumber: JOI_PHONE_NUMBER.allow(null).required(),
    status: JOI_SESSION_STATUS.required(),
    username: Joi.string().allow(null).required(),
  })
  .required();

export class StrategySession
  extends LindormEntity<StrategySessionAttributes>
  implements StrategySessionAttributes
{
  public readonly authenticationSessionId: string;
  public readonly email: string | null;
  public readonly expires: Date;
  public readonly strategy: AuthenticationStrategy;
  public readonly nin: string | null;
  public readonly phoneNumber: string | null;
  public readonly username: string | null;

  public code: string | null;
  public nonce: string | null;
  public otp: string | null;
  public status: SessionStatus;

  public constructor(options: StrategySessionOptions) {
    super(options);

    this.authenticationSessionId = options.authenticationSessionId;
    this.code = options.code || null;
    this.email = options.email || null;
    this.expires = options.expires;
    this.strategy = options.strategy;
    this.nin = options.nin || null;
    this.nonce = options.nonce || null;
    this.otp = options.otp || null;
    this.phoneNumber = options.phoneNumber || null;
    this.status = options.status || SessionStatuses.PENDING;
    this.username = options.username || null;
  }

  public create(): void {
    /* intentionally left empty */
  }

  public async schemaValidation(): Promise<void> {
    await schema.validateAsync(this.toJSON());
  }

  public toJSON(): StrategySessionAttributes {
    return {
      ...this.defaultJSON(),

      authenticationSessionId: this.authenticationSessionId,
      code: this.code,
      email: this.email,
      expires: this.expires,
      strategy: this.strategy,
      nin: this.nin,
      nonce: this.nonce,
      otp: this.otp,
      phoneNumber: this.phoneNumber,
      status: this.status,
      username: this.username,
    };
  }
}
