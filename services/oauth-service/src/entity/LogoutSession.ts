import Joi from "joi";
import { LogoutSessionType } from "../enum";
import { JOI_GUID, JOI_JWT, JOI_SESSION_STATUS, SessionStatus } from "../common";
import {
  EntityAttributes,
  EntityKeys,
  JOI_ENTITY_BASE,
  LindormEntity,
  Optional,
} from "@lindorm-io/entity";

export interface LogoutSessionAttributes extends EntityAttributes {
  clientId: string;
  expires: Date;
  idTokenHint: string | null;
  originalUri: string;
  redirectUri: string | null;
  sessionId: string;
  sessionType: LogoutSessionType;
  state: string | null;
  status: SessionStatus;
}

export type LogoutSessionOptions = Optional<
  LogoutSessionAttributes,
  EntityKeys | "idTokenHint" | "redirectUri" | "state" | "status"
>;

const schema = Joi.object<LogoutSessionAttributes>({
  ...JOI_ENTITY_BASE,

  clientId: JOI_GUID.required(),
  expires: Joi.date().required(),
  idTokenHint: JOI_JWT.allow(null).required(),
  originalUri: Joi.string().required(),
  redirectUri: Joi.string().uri().allow(null).required(),
  sessionId: JOI_GUID.required(),
  sessionType: Joi.string().required(),
  state: Joi.string().allow(null).required(),
  status: JOI_SESSION_STATUS.required(),
});

export class LogoutSession extends LindormEntity<LogoutSessionAttributes> {
  public readonly clientId: string;
  public readonly expires: Date;
  public readonly idTokenHint: string | null;
  public readonly originalUri: string;
  public readonly redirectUri: string | null;
  public readonly sessionId: string;
  public readonly sessionType: LogoutSessionType;
  public readonly state: string | null;

  public status: SessionStatus;

  public constructor(options: LogoutSessionOptions) {
    super(options);

    this.clientId = options.clientId;
    this.expires = options.expires;
    this.idTokenHint = options.idTokenHint || null;
    this.originalUri = options.originalUri;
    this.redirectUri = options.redirectUri || null;
    this.sessionId = options.sessionId;
    this.sessionType = options.sessionType;
    this.state = options.state || null;
    this.status = options.status || SessionStatus.PENDING;
  }

  public async schemaValidation(): Promise<void> {
    await schema.validateAsync(this.toJSON());
  }

  public toJSON(): LogoutSessionAttributes {
    return {
      ...this.defaultJSON(),

      clientId: this.clientId,
      expires: this.expires,
      idTokenHint: this.idTokenHint,
      originalUri: this.originalUri,
      redirectUri: this.redirectUri,
      sessionId: this.sessionId,
      sessionType: this.sessionType,
      state: this.state,
      status: this.status,
    };
  }
}
