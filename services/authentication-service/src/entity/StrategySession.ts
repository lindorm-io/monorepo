import Joi from "joi";
import { AuthenticationMethod } from "../enum";
import { JOI_AUTHENTICATION_METHOD } from "../constant";
import {
  JOI_EMAIL,
  JOI_GUID,
  JOI_PHONE_NUMBER,
  JOI_SESSION_STATUS,
  SessionStatus,
} from "../common";
import {
  EntityAttributes,
  EntityKeys,
  JOI_ENTITY_BASE,
  LindormEntity,
  Optional,
} from "@lindorm-io/entity";

export interface StrategySessionAttributes extends EntityAttributes {
  authenticationSessionId: string;
  code: string | null;
  email: string | null;
  expires: Date;
  method: AuthenticationMethod;
  nin: string | null;
  nonce: string | null;
  otp: string | null;
  phoneNumber: string | null;
  status: SessionStatus;
  username: string | null;
}

export type StrategySessionOptions = Optional<
  StrategySessionAttributes,
  EntityKeys | "code" | "email" | "nin" | "nonce" | "otp" | "phoneNumber" | "status" | "username"
>;

const schema = Joi.object<StrategySessionAttributes>()
  .keys({
    ...JOI_ENTITY_BASE,

    authenticationSessionId: JOI_GUID.required(),
    code: Joi.string().allow(null).required(),
    email: JOI_EMAIL.allow(null).required(),
    expires: Joi.date().required(),
    method: JOI_AUTHENTICATION_METHOD.required(),
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
  public readonly method: AuthenticationMethod;
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
    this.method = options.method;
    this.nin = options.nin || null;
    this.nonce = options.nonce || null;
    this.otp = options.otp || null;
    this.phoneNumber = options.phoneNumber || null;
    this.status = options.status || SessionStatus.PENDING;
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
      method: this.method,
      nin: this.nin,
      nonce: this.nonce,
      otp: this.otp,
      phoneNumber: this.phoneNumber,
      status: this.status,
      username: this.username,
    };
  }
}
