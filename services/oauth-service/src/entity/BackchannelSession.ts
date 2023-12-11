import {
  AuthenticationFactor,
  AuthenticationMethod,
  AuthenticationStrategy,
  Scope,
  SessionStatus,
} from "@lindorm-io/common-enums";
import { LevelOfAssurance } from "@lindorm-io/common-types";
import {
  EntityAttributes,
  EntityKeys,
  JOI_ENTITY_BASE,
  LindormEntity,
  Optional,
} from "@lindorm-io/entity";
import Joi from "joi";
import { JOI_LEVEL_OF_ASSURANCE } from "../common";

type ConfirmedConsent = {
  audiences: Array<string>;
  scopes: Array<Scope | string>;
};

type ConfirmedLogin = {
  factors: Array<AuthenticationFactor>;
  identityId: string | null;
  latestAuthentication: Date | null;
  levelOfAssurance: LevelOfAssurance;
  metadata: Record<string, any>;
  methods: Array<AuthenticationMethod>;
  remember: boolean;
  singleSignOn: boolean;
  strategies: Array<AuthenticationStrategy>;
};

type RequestedConsent = {
  audiences: Array<string>;
  scopes: Array<Scope | string>;
};

type RequestedLogin = {
  factors: Array<AuthenticationFactor>;
  identityId: string | null;
  levelOfAssurance: LevelOfAssurance;
  methods: Array<AuthenticationMethod>;
  minimumLevelOfAssurance: LevelOfAssurance;
  strategies: Array<AuthenticationStrategy>;
};

type Status = {
  consent: SessionStatus;
  login: SessionStatus;
};

export type BackchannelSessionAttributes = EntityAttributes & {
  confirmedConsent: ConfirmedConsent;
  confirmedLogin: ConfirmedLogin;
  requestedConsent: RequestedConsent;
  requestedLogin: RequestedLogin;
  status: Status;

  bindingMessage: string | null;
  clientId: string;
  clientNotificationToken: string | null;
  clientSessionId: string | null;
  expires: Date;
  idTokenHint: string | null;
  loginHint: string | null;
  loginHintToken: string | null;
  requestedExpiry: number;
  userCode: string | null;
};

export type BackchannelSessionOptions = Optional<
  BackchannelSessionAttributes,
  | EntityKeys
  | "bindingMessage"
  | "clientNotificationToken"
  | "clientSessionId"
  | "confirmedConsent"
  | "confirmedLogin"
  | "idTokenHint"
  | "loginHint"
  | "loginHintToken"
  | "requestedExpiry"
  | "status"
  | "userCode"
>;

const schema = Joi.object<BackchannelSessionAttributes>()
  .keys({
    ...JOI_ENTITY_BASE,

    confirmedConsent: Joi.object<ConfirmedConsent>()
      .keys({
        audiences: Joi.array().items(Joi.string().guid()).required(),
        scopes: Joi.array().items(Joi.string().lowercase()).required(),
      })
      .required(),
    confirmedLogin: Joi.object<ConfirmedLogin>()
      .keys({
        factors: Joi.array().items(Joi.string().lowercase()).required(),
        identityId: Joi.string().guid().allow(null).required(),
        latestAuthentication: Joi.date().allow(null).required(),
        levelOfAssurance: JOI_LEVEL_OF_ASSURANCE.required(),
        metadata: Joi.object().required(),
        methods: Joi.array().items(Joi.string().lowercase()).required(),
        remember: Joi.boolean().required(),
        singleSignOn: Joi.boolean().required(),
        strategies: Joi.array().items(Joi.string().lowercase()).required(),
      })
      .required(),
    requestedConsent: Joi.object<RequestedConsent>()
      .keys({
        audiences: Joi.array().items(Joi.string().guid()).required(),
        scopes: Joi.array().items(Joi.string().lowercase()).required(),
      })
      .required(),
    requestedLogin: Joi.object<RequestedLogin>()
      .keys({
        factors: Joi.array().items(Joi.string().lowercase()).required(),
        identityId: Joi.string().guid().allow(null).required(),
        levelOfAssurance: JOI_LEVEL_OF_ASSURANCE.required(),
        methods: Joi.array().items(Joi.string()).required(),
        minimumLevelOfAssurance: JOI_LEVEL_OF_ASSURANCE.required(),
        strategies: Joi.array().items(Joi.string().lowercase()).required(),
      })
      .required(),
    status: Joi.object<Status>()
      .keys({
        consent: Joi.string()
          .valid(...Object.values(SessionStatus))
          .required(),
        login: Joi.string()
          .valid(...Object.values(SessionStatus))
          .required(),
      })
      .required(),

    bindingMessage: Joi.string().allow(null).required(),
    clientId: Joi.string().guid().required(),
    clientNotificationToken: Joi.string().allow(null).required(),
    clientSessionId: Joi.string().guid().allow(null).required(),
    expires: Joi.date().required(),
    idTokenHint: Joi.string().allow(null).required(),
    loginHint: Joi.string().allow(null).required(),
    loginHintToken: Joi.string().allow(null).required(),
    requestedExpiry: Joi.number().required(),
    userCode: Joi.string().allow(null).required(),
  })
  .required();

export class BackchannelSession extends LindormEntity<BackchannelSessionAttributes> {
  public readonly confirmedConsent: ConfirmedConsent;
  public readonly confirmedLogin: ConfirmedLogin;
  public readonly requestedConsent: RequestedConsent;
  public readonly requestedLogin: RequestedLogin;
  public readonly status: Status;

  public readonly bindingMessage: string | null;
  public readonly clientId: string;
  public readonly clientNotificationToken: string | null;
  public readonly expires: Date;
  public readonly idTokenHint: string | null;
  public readonly loginHint: string | null;
  public readonly loginHintToken: string | null;
  public readonly requestedExpiry: number;
  public readonly userCode: string | null;

  public clientSessionId: string | null;

  public constructor(options: BackchannelSessionOptions) {
    super(options);

    this.confirmedConsent = {
      audiences: options.confirmedConsent?.audiences || [],
      scopes: options.confirmedConsent?.scopes || [],
    };
    this.confirmedLogin = {
      factors: options.confirmedLogin?.factors || [],
      identityId: options.confirmedLogin?.identityId || null,
      latestAuthentication: options.confirmedLogin?.latestAuthentication || null,
      levelOfAssurance: options.confirmedLogin?.levelOfAssurance || 0,
      metadata: options.confirmedLogin?.metadata || {},
      methods: options.confirmedLogin?.methods || [],
      remember: options.confirmedLogin?.remember === true,
      singleSignOn: options.confirmedLogin?.singleSignOn === true,
      strategies: options.confirmedLogin?.strategies || [],
    };
    this.requestedConsent = {
      audiences: options.requestedConsent.audiences,
      scopes: options.requestedConsent.scopes,
    };
    this.requestedLogin = {
      factors: options.requestedLogin.factors,
      identityId: options.requestedLogin.identityId,
      levelOfAssurance: options.requestedLogin.levelOfAssurance,
      methods: options.requestedLogin.methods,
      minimumLevelOfAssurance: options.requestedLogin.minimumLevelOfAssurance,
      strategies: options.requestedLogin.strategies,
    };
    this.status = {
      consent: options.status?.consent || SessionStatus.PENDING,
      login: options.status?.login || SessionStatus.PENDING,
    };

    this.bindingMessage = options.bindingMessage || null;
    this.clientId = options.clientId;
    this.clientNotificationToken = options.clientNotificationToken || null;
    this.clientSessionId = options.clientSessionId || null;
    this.expires = options.expires;
    this.idTokenHint = options.idTokenHint || null;
    this.loginHint = options.loginHint || null;
    this.loginHintToken = options.loginHintToken || null;
    this.requestedExpiry = options.requestedExpiry || 0;
    this.userCode = options.userCode || null;
  }

  public async schemaValidation(): Promise<void> {
    await schema.validateAsync(this.toJSON());
  }

  public toJSON(): BackchannelSessionAttributes {
    return {
      ...this.defaultJSON(),

      bindingMessage: this.bindingMessage,
      clientId: this.clientId,
      clientNotificationToken: this.clientNotificationToken,
      clientSessionId: this.clientSessionId,
      confirmedConsent: this.confirmedConsent,
      confirmedLogin: this.confirmedLogin,
      expires: this.expires,
      idTokenHint: this.idTokenHint,
      loginHint: this.loginHint,
      loginHintToken: this.loginHintToken,
      requestedConsent: this.requestedConsent,
      requestedExpiry: this.requestedExpiry,
      requestedLogin: this.requestedLogin,
      status: this.status,
      userCode: this.userCode,
    };
  }

  public confirmConsent(data: ConfirmedConsent): void {
    this.confirmedConsent.audiences = data.audiences;
    this.confirmedConsent.scopes = data.scopes;

    this.status.consent = SessionStatus.CONFIRMED;
  }

  public confirmLogin(data: ConfirmedLogin): void {
    this.confirmedLogin.factors = data.factors;
    this.confirmedLogin.identityId = data.identityId;
    this.confirmedLogin.latestAuthentication = data.latestAuthentication;
    this.confirmedLogin.levelOfAssurance = data.levelOfAssurance;
    this.confirmedLogin.metadata = data.metadata;
    this.confirmedLogin.methods = data.methods;
    this.confirmedLogin.remember = data.remember;
    this.confirmedLogin.singleSignOn = data.singleSignOn;
    this.confirmedLogin.strategies = data.strategies;

    this.status.login = SessionStatus.CONFIRMED;
  }
}
