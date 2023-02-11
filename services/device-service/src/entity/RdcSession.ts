import Joi from "joi";
import { JOI_NONCE, JOI_SESSION_STATUS } from "../common";
import {
  JOI_FACTORS,
  JOI_RDC_CONFIRM_METHOD,
  JOI_RDC_MODE,
  JOI_RDC_REJECT_METHOD,
  JOI_RDC_TYPE,
} from "../constant";
import {
  EntityAttributes,
  EntityKeys,
  JOI_ENTITY_BASE,
  LindormEntity,
  Optional,
} from "@lindorm-io/entity";
import {
  RdcSessionMethod,
  RdcSessionMethods,
  RdcSessionMode,
  RdcSessionType,
  SessionStatus,
  SessionStatuses,
} from "@lindorm-io/common-types";

export interface RdcSessionAttributes extends EntityAttributes {
  audiences: Array<string>;
  confirmMethod: RdcSessionMethod;
  confirmPayload: Record<string, any>;
  confirmUri: string | null;
  deviceLinks: Array<string>;
  enrolmentSessionId: string | null;
  expires: Date;
  factors: number;
  identityId: string | null;
  mode: RdcSessionMode;
  nonce: string;
  rejectMethod: RdcSessionMethod;
  rejectPayload: Record<string, any>;
  rejectUri: string | null;
  scopes: Array<string>;
  status: SessionStatus;
  templateName: string | null;
  templateParameters: Record<string, any>;
  tokenPayload: Record<string, any>;
  type: RdcSessionType;
}

export type RdcSessionOptions = Optional<
  RdcSessionAttributes,
  | EntityKeys
  | "audiences"
  | "confirmMethod"
  | "confirmPayload"
  | "confirmUri"
  | "enrolmentSessionId"
  | "factors"
  | "identityId"
  | "rejectMethod"
  | "rejectPayload"
  | "rejectUri"
  | "scopes"
  | "status"
  | "templateName"
  | "templateParameters"
  | "tokenPayload"
>;

const schema = Joi.object<RdcSessionAttributes>()
  .keys({
    ...JOI_ENTITY_BASE,

    audiences: Joi.array().items(Joi.string().guid()).required(),
    confirmMethod: JOI_RDC_CONFIRM_METHOD.required(),
    confirmPayload: Joi.object().required(),
    confirmUri: Joi.string().uri().allow(null).required(),
    deviceLinks: Joi.array().items(Joi.string()).required(),
    enrolmentSessionId: Joi.string().guid().allow(null).required(),
    expires: Joi.date().required(),
    factors: JOI_FACTORS.required(),
    identityId: Joi.string().guid().allow(null).required(),
    mode: JOI_RDC_MODE.required(),
    nonce: JOI_NONCE.required(),
    rejectMethod: JOI_RDC_REJECT_METHOD.required(),
    rejectPayload: Joi.object().required(),
    rejectUri: Joi.string().uri().allow(null).required(),
    scopes: Joi.array().items(Joi.string()).required(),
    status: JOI_SESSION_STATUS.required(),
    templateName: Joi.string().allow(null).required(),
    templateParameters: Joi.object().required(),
    tokenPayload: Joi.object().required(),
    type: JOI_RDC_TYPE.required(),
  })
  .required();

export class RdcSession extends LindormEntity<RdcSessionAttributes> {
  public readonly audiences: Array<string>;
  public readonly confirmMethod: RdcSessionMethod;
  public readonly confirmPayload: Record<string, any>;
  public readonly confirmUri: string | null;
  public readonly deviceLinks: Array<string>;
  public readonly enrolmentSessionId: string | null;
  public readonly expires: Date;
  public readonly factors: number;
  public readonly identityId: string | null;
  public readonly mode: RdcSessionMode;
  public readonly nonce: string;
  public readonly rejectMethod: RdcSessionMethod;
  public readonly rejectPayload: Record<string, any>;
  public readonly rejectUri: string | null;
  public readonly scopes: Array<string>;
  public readonly templateName: string | null;
  public readonly templateParameters: Record<string, any>;
  public readonly tokenPayload: Record<string, any>;
  public readonly type: RdcSessionType;

  public status: SessionStatus;

  public constructor(options: RdcSessionOptions) {
    super(options);

    this.audiences = options.audiences || [];
    this.confirmMethod = options.confirmMethod || RdcSessionMethods.POST;
    this.confirmPayload = options.confirmPayload || {};
    this.confirmUri = options.confirmUri || null;
    this.deviceLinks = options.deviceLinks;
    this.enrolmentSessionId = options.enrolmentSessionId || null;
    this.expires = options.expires;
    this.factors = options.factors || 2;
    this.identityId = options.identityId || null;
    this.mode = options.mode;
    this.nonce = options.nonce;
    this.rejectMethod = options.rejectMethod || RdcSessionMethods.POST;
    this.rejectPayload = options.confirmPayload || {};
    this.rejectUri = options.rejectUri || null;
    this.scopes = options.scopes || [];
    this.status = options.status || SessionStatuses.PENDING;
    this.templateName = options.templateName || null;
    this.templateParameters = options.templateParameters || {};
    this.tokenPayload = options.tokenPayload || {};
    this.type = options.type;
  }

  public async schemaValidation(): Promise<void> {
    await schema.validateAsync(this.toJSON());
  }

  public toJSON(): RdcSessionAttributes {
    return {
      ...this.defaultJSON(),

      audiences: this.audiences,
      confirmMethod: this.confirmMethod,
      confirmPayload: this.confirmPayload,
      confirmUri: this.confirmUri,
      deviceLinks: this.deviceLinks,
      enrolmentSessionId: this.enrolmentSessionId,
      expires: this.expires,
      factors: this.factors,
      identityId: this.identityId,
      mode: this.mode,
      nonce: this.nonce,
      rejectMethod: this.rejectMethod,
      rejectPayload: this.rejectPayload,
      rejectUri: this.rejectUri,
      scopes: this.scopes,
      status: this.status,
      templateName: this.templateName,
      templateParameters: this.templateParameters,
      tokenPayload: this.tokenPayload,
      type: this.type,
    };
  }
}
