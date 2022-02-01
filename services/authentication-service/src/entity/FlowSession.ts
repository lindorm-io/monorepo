import Joi from "joi";
import { FlowType } from "../enum";
import { JOI_FLOW_TYPE } from "../constant";
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

export interface FlowSessionAttributes extends EntityAttributes {
  code: string | null;
  email: string | null;
  expires: Date;
  loginSessionId: string;
  nin: string | null;
  nonce: string | null;
  otp: string | null;
  phoneNumber: string | null;
  status: SessionStatus;
  type: FlowType;
  username: string | null;
}

export type FlowSessionOptions = Optional<
  FlowSessionAttributes,
  | EntityKeys
  | "code"
  | "email"
  | "expires"
  | "nin"
  | "nonce"
  | "otp"
  | "phoneNumber"
  | "status"
  | "username"
>;

const schema = Joi.object<FlowSessionAttributes>({
  ...JOI_ENTITY_BASE,

  code: Joi.string().allow(null).required(),
  email: JOI_EMAIL.allow(null).required(),
  expires: Joi.date().required(),
  loginSessionId: JOI_GUID.required(),
  nin: Joi.string().allow(null).required(),
  nonce: Joi.string().allow(null).required(),
  otp: Joi.string().allow(null).required(),
  phoneNumber: JOI_PHONE_NUMBER.allow(null).required(),
  status: JOI_SESSION_STATUS.required(),
  type: JOI_FLOW_TYPE.required(),
  username: Joi.string().allow(null).required(),
});

export class FlowSession
  extends LindormEntity<FlowSessionAttributes>
  implements FlowSessionAttributes
{
  public readonly loginSessionId: string;
  public readonly type: FlowType;

  public code: string | null;
  public email: string | null;
  public expires: Date;
  public nin: string | null;
  public nonce: string | null;
  public otp: string | null;
  public phoneNumber: string | null;
  public status: SessionStatus;
  public username: string | null;

  public constructor(options: FlowSessionOptions) {
    super(options);

    this.code = options.code || null;
    this.email = options.email || null;
    this.expires = options.expires;
    this.loginSessionId = options.loginSessionId;
    this.nin = options.nin || null;
    this.nonce = options.nonce || null;
    this.otp = options.otp || null;
    this.phoneNumber = options.phoneNumber || null;
    this.status = options.status || SessionStatus.PENDING;
    this.type = options.type;
    this.username = options.username || null;
  }

  public create(): void {
    /* intentionally left empty */
  }

  public async schemaValidation(): Promise<void> {
    await schema.validateAsync(this.toJSON());
  }

  public toJSON(): FlowSessionAttributes {
    return {
      ...this.defaultJSON(),

      code: this.code,
      email: this.email,
      expires: this.expires,
      loginSessionId: this.loginSessionId,
      nin: this.nin,
      nonce: this.nonce,
      otp: this.otp,
      phoneNumber: this.phoneNumber,
      status: this.status,
      type: this.type,
      username: this.username,
    };
  }
}
