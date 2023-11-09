import { OpenIdDisplayMode, SessionStatus } from "@lindorm-io/common-enums";
import {
  EntityAttributes,
  EntityKeys,
  JOI_ENTITY_BASE,
  LindormEntity,
  Optional,
} from "@lindorm-io/entity";
import Joi from "joi";
import { JOI_JWT, JOI_STATE } from "../common";

type ConfirmedLogout = {
  browserSessionId: string | null;
  clientSessionId: string | null;
};

type RequestedLogout = {
  browserSessionId: string;
  clientSessionId: string | null;
};

export type LogoutSessionAttributes = EntityAttributes & {
  clientId: string | null;
  confirmedLogout: ConfirmedLogout;
  displayMode: OpenIdDisplayMode;
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
  | "displayMode"
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
        browserSessionId: Joi.string().guid().allow(null).required(),
        clientSessionId: Joi.string().guid().allow(null).required(),
      })
      .required(),
    requestedLogout: Joi.object<RequestedLogout>()
      .keys({
        browserSessionId: Joi.string().guid().required(),
        clientSessionId: Joi.string().guid().allow(null).required(),
      })
      .required(),

    clientId: Joi.string().guid().required(),
    displayMode: Joi.string()
      .valid(...Object.values(OpenIdDisplayMode))
      .required(),
    expires: Joi.date().required(),
    idTokenHint: JOI_JWT.allow(null).required(),
    identityId: Joi.string().guid().required(),
    logoutHint: Joi.string().allow(null).required(),
    originalUri: Joi.string().uri().required(),
    postLogoutRedirectUri: Joi.string().uri().allow(null).required(),
    state: JOI_STATE.allow(null).required(),
    status: Joi.string()
      .valid(...Object.values(SessionStatus))
      .required(),
    uiLocales: Joi.array().items(Joi.string()).required(),
  })
  .required();

export class LogoutSession extends LindormEntity<LogoutSessionAttributes> {
  public readonly clientId: string | null;
  public readonly confirmedLogout: ConfirmedLogout;
  public readonly displayMode: OpenIdDisplayMode;
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
      browserSessionId: options.confirmedLogout?.browserSessionId || null,
      clientSessionId: options.confirmedLogout?.clientSessionId || null,
    };
    this.requestedLogout = {
      browserSessionId: options.requestedLogout.browserSessionId,
      clientSessionId: options.requestedLogout.clientSessionId,
    };

    this.clientId = options.clientId || null;
    this.displayMode = options.displayMode || OpenIdDisplayMode.PAGE;
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
      displayMode: this.displayMode,
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
