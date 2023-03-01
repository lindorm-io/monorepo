import Joi from "joi";
import { JOI_JWT, JOI_SESSION_STATUS, JOI_STATE } from "../common";
import { SessionStatus } from "@lindorm-io/common-types";
import {
  EntityAttributes,
  EntityKeys,
  JOI_ENTITY_BASE,
  LindormEntity,
  Optional,
} from "@lindorm-io/entity";

type ConfirmedLogout = {
  accessSessionId: string | null;
  refreshSessionId: string | null;
  browserSessionId: string | null;
};

type RequestedLogout = {
  accessSessionId: string | null;
  browserSessionId: string;
  refreshSessionId: string | null;
};

export type LogoutSessionAttributes = EntityAttributes & {
  clientId: string | null;
  confirmedLogout: ConfirmedLogout;
  expires: Date;
  idTokenHint: string | null;
  identityId: string;
  logoutHint: string | null;
  originalUri: string;
  postLogoutRedirectUri: string | null;
  requestedLogout: RequestedLogout;
  state: string | null;
  status: SessionStatus;
  uiLocales: Array<string>;
};

export type LogoutSessionOptions = Optional<
  LogoutSessionAttributes,
  | EntityKeys
  | "confirmedLogout"
  | "idTokenHint"
  | "logoutHint"
  | "postLogoutRedirectUri"
  | "state"
  | "status"
  | "uiLocales"
>;

const schema = Joi.object<LogoutSessionAttributes>()
  .keys({
    ...JOI_ENTITY_BASE,

    confirmedLogout: Joi.object<ConfirmedLogout>()
      .keys({
        accessSessionId: Joi.string().guid().allow(null).required(),
        browserSessionId: Joi.string().guid().allow(null).required(),
        refreshSessionId: Joi.string().guid().allow(null).required(),
      })
      .required(),
    requestedLogout: Joi.object<RequestedLogout>()
      .keys({
        accessSessionId: Joi.string().guid().allow(null).required(),
        browserSessionId: Joi.string().guid().required(),
        refreshSessionId: Joi.string().guid().allow(null).required(),
      })
      .required(),

    clientId: Joi.string().guid().required(),
    expires: Joi.date().required(),
    idTokenHint: JOI_JWT.allow(null).required(),
    identityId: Joi.string().guid().required(),
    logoutHint: Joi.string().allow(null).required(),
    originalUri: Joi.string().uri().required(),
    postLogoutRedirectUri: Joi.string().uri().allow(null).required(),
    state: JOI_STATE.allow(null).required(),
    status: JOI_SESSION_STATUS.required(),
    uiLocales: Joi.array().items(Joi.string()).required(),
  })
  .required();

export class LogoutSession extends LindormEntity<LogoutSessionAttributes> {
  public readonly clientId: string | null;
  public readonly confirmedLogout: ConfirmedLogout;
  public readonly expires: Date;
  public readonly idTokenHint: string | null;
  public readonly identityId: string;
  public readonly logoutHint: string | null;
  public readonly originalUri: string;
  public readonly postLogoutRedirectUri: string | null;
  public readonly requestedLogout: RequestedLogout;
  public readonly state: string | null;
  public readonly uiLocales: Array<string>;

  public status: SessionStatus;

  public constructor(options: LogoutSessionOptions) {
    super(options);

    this.confirmedLogout = {
      accessSessionId: options.confirmedLogout?.accessSessionId || null,
      browserSessionId: options.confirmedLogout?.browserSessionId || null,
      refreshSessionId: options.confirmedLogout?.refreshSessionId || null,
    };
    this.requestedLogout = {
      accessSessionId: options.requestedLogout.accessSessionId,
      browserSessionId: options.requestedLogout.browserSessionId,
      refreshSessionId: options.requestedLogout.refreshSessionId,
    };

    this.clientId = options.clientId || null;
    this.expires = options.expires;
    this.idTokenHint = options.idTokenHint || null;
    this.identityId = options.identityId;
    this.logoutHint = options.logoutHint || null;
    this.originalUri = options.originalUri;
    this.postLogoutRedirectUri = options.postLogoutRedirectUri || null;
    this.state = options.state || null;
    this.status = options.status || SessionStatus.PENDING;
    this.uiLocales = options.uiLocales || [];
  }

  public async schemaValidation(): Promise<void> {
    await schema.validateAsync(this.toJSON());
  }

  public toJSON(): LogoutSessionAttributes {
    return {
      ...this.defaultJSON(),

      clientId: this.clientId,
      confirmedLogout: this.confirmedLogout,
      expires: this.expires,
      idTokenHint: this.idTokenHint,
      identityId: this.identityId,
      logoutHint: this.logoutHint,
      originalUri: this.originalUri,
      postLogoutRedirectUri: this.postLogoutRedirectUri,
      requestedLogout: this.requestedLogout,
      state: this.state,
      status: this.status,
      uiLocales: this.uiLocales,
    };
  }
}
