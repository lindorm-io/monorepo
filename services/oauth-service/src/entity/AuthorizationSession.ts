import {
  AuthenticationFactor,
  AuthenticationMethod,
  AuthenticationStrategy,
  OpenIdDisplayMode,
  OpenIdPromptMode,
  OpenIdResponseMode,
  OpenIdResponseType,
  PKCEMethod,
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
import { randomUnreserved } from "@lindorm-io/random";
import Joi from "joi";
import {
  JOI_COUNTRY_CODE,
  JOI_JWT,
  JOI_LEVEL_OF_ASSURANCE,
  JOI_LOCALE,
  JOI_NONCE,
  JOI_SESSION_STATUS,
  JOI_STATE,
} from "../common";
import {
  JOI_CODE_CHALLENGE,
  JOI_DISPLAY_MODE,
  JOI_PKCE_METHOD,
  JOI_PROMPT_MODE,
  JOI_RESPONSE_MODE,
  JOI_RESPONSE_TYPE,
} from "../constant";

export type BrowserSessionLike = {
  browserSessionId: string;
  identityId: string;
};

type Code = {
  codeChallenge: string | null;
  codeChallengeMethod: PKCEMethod | null;
};

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

type RequestedSelectAccount = {
  browserSessions: Array<BrowserSessionLike>;
};

type Status = {
  consent: SessionStatus;
  login: SessionStatus;
  selectAccount: SessionStatus;
};

export type AuthorizationSessionAttributes = EntityAttributes & {
  code: Code;
  confirmedConsent: ConfirmedConsent;
  confirmedLogin: ConfirmedLogin;
  requestedConsent: RequestedConsent;
  requestedLogin: RequestedLogin;
  requestedSelectAccount: RequestedSelectAccount;
  status: Status;

  browserSessionId: string | null;
  clientId: string;
  clientSessionId: string | null;
  country: string | null;
  displayMode: OpenIdDisplayMode;
  expires: Date;
  idTokenHint: string | null;
  loginHint: Array<string>;
  maxAge: number | null;
  nonce: string;
  originalUri: string;
  promptModes: Array<OpenIdPromptMode>;
  redirectData: string | null;
  redirectUri: string;
  responseMode: OpenIdResponseMode;
  responseTypes: Array<OpenIdResponseType>;
  state: string;
  uiLocales: Array<string>;
};

export type AuthorizationSessionOptions = Optional<
  AuthorizationSessionAttributes,
  | EntityKeys
  | "browserSessionId"
  | "clientSessionId"
  | "code"
  | "confirmedConsent"
  | "confirmedLogin"
  | "country"
  | "displayMode"
  | "idTokenHint"
  | "loginHint"
  | "maxAge"
  | "nonce"
  | "promptModes"
  | "redirectData"
  | "responseMode"
  | "state"
  | "status"
  | "uiLocales"
>;

const schema = Joi.object<AuthorizationSessionAttributes>()
  .keys({
    ...JOI_ENTITY_BASE,

    code: Joi.object<Code>()
      .keys({
        codeChallenge: JOI_CODE_CHALLENGE.allow(null).required(),
        codeChallengeMethod: JOI_PKCE_METHOD.allow(null).required(),
      })
      .required(),
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
    requestedSelectAccount: Joi.object<RequestedSelectAccount>()
      .keys({
        browserSessions: Joi.array()
          .items(
            Joi.object<BrowserSessionLike>().keys({
              browserSessionId: Joi.string().guid().required(),
              identityId: Joi.string().guid().required(),
            }),
          )
          .required(),
      })
      .required(),
    status: Joi.object<Status>()
      .keys({
        consent: JOI_SESSION_STATUS.required(),
        login: JOI_SESSION_STATUS.required(),
        selectAccount: JOI_SESSION_STATUS.required(),
      })
      .required(),

    browserSessionId: Joi.string().guid().allow(null).required(),
    clientId: Joi.string().guid().required(),
    clientSessionId: Joi.string().guid().allow(null).required(),
    country: JOI_COUNTRY_CODE.allow(null).required(),
    displayMode: JOI_DISPLAY_MODE.required(),
    expires: Joi.date().required(),
    idTokenHint: JOI_JWT.allow(null).required(),
    loginHint: Joi.array().items(Joi.string().lowercase()).required(),
    maxAge: Joi.number().allow(null).required(),
    nonce: JOI_NONCE.required(),
    originalUri: Joi.string().uri().required(),
    promptModes: Joi.array().items(JOI_PROMPT_MODE).required(),
    redirectData: Joi.string().base64().allow(null).required(),
    redirectUri: Joi.string().uri().required(),
    responseMode: JOI_RESPONSE_MODE.required(),
    responseTypes: Joi.array().items(JOI_RESPONSE_TYPE).required(),
    state: JOI_STATE.required(),
    uiLocales: Joi.array().items(JOI_LOCALE).required(),
  })
  .required();

// TODO make login hint a string and remove array logic

export class AuthorizationSession extends LindormEntity<AuthorizationSessionAttributes> {
  public readonly code: Code;
  public readonly confirmedConsent: ConfirmedConsent;
  public readonly confirmedLogin: ConfirmedLogin;
  public readonly requestedConsent: RequestedConsent;
  public readonly requestedLogin: RequestedLogin;
  public readonly requestedSelectAccount: RequestedSelectAccount;
  public readonly status: Status;

  public readonly clientId: string;
  public readonly country: string | null;
  public readonly displayMode: OpenIdDisplayMode;
  public readonly expires: Date;
  public readonly idTokenHint: string | null;
  public readonly loginHint: Array<string>;
  public readonly maxAge: number | null;
  public readonly nonce: string;
  public readonly originalUri: string;
  public readonly promptModes: Array<OpenIdPromptMode>;
  public readonly redirectData: string | null;
  public readonly redirectUri: string;
  public readonly responseMode: OpenIdResponseMode;
  public readonly responseTypes: Array<OpenIdResponseType>;
  public readonly state: string;
  public readonly uiLocales: Array<string>;

  public browserSessionId: string | null;
  public clientSessionId: string | null;

  public constructor(options: AuthorizationSessionOptions) {
    super(options);

    this.code = {
      codeChallenge: options.code?.codeChallenge || null,
      codeChallengeMethod: options.code?.codeChallengeMethod || null,
    };
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
    this.requestedSelectAccount = {
      browserSessions: options.requestedSelectAccount.browserSessions,
    };
    this.status = {
      consent: options.status?.consent || SessionStatus.PENDING,
      login: options.status?.login || SessionStatus.PENDING,
      selectAccount: options.status?.selectAccount || SessionStatus.PENDING,
    };

    this.browserSessionId = options.browserSessionId || null;
    this.clientId = options.clientId;
    this.clientSessionId = options.clientSessionId || null;
    this.country = options.country || null;
    this.displayMode = options.displayMode || OpenIdDisplayMode.PAGE;
    this.expires = options.expires;
    this.idTokenHint = options.idTokenHint || null;
    this.loginHint = options.loginHint || [];
    this.maxAge = options.maxAge || null;
    this.nonce = options.nonce || randomUnreserved(16);
    this.originalUri = options.originalUri;
    this.promptModes = options.promptModes || [];
    this.redirectData = options.redirectData || null;
    this.redirectUri = options.redirectUri;
    this.responseMode = options.responseMode || OpenIdResponseMode.QUERY;
    this.responseTypes = options.responseTypes;
    this.state = options.state || randomUnreserved(16);
    this.uiLocales = options.uiLocales || [];
  }

  public async schemaValidation(): Promise<void> {
    await schema.validateAsync(this.toJSON());
  }

  public toJSON(): AuthorizationSessionAttributes {
    return {
      ...this.defaultJSON(),

      browserSessionId: this.browserSessionId,
      clientId: this.clientId,
      clientSessionId: this.clientSessionId,
      code: this.code,
      confirmedConsent: this.confirmedConsent,
      confirmedLogin: this.confirmedLogin,
      country: this.country,
      displayMode: this.displayMode,
      expires: this.expires,
      idTokenHint: this.idTokenHint,
      loginHint: this.loginHint,
      maxAge: this.maxAge,
      nonce: this.nonce,
      originalUri: this.originalUri,
      promptModes: this.promptModes,
      redirectData: this.redirectData,
      redirectUri: this.redirectUri,
      requestedConsent: this.requestedConsent,
      requestedLogin: this.requestedLogin,
      requestedSelectAccount: this.requestedSelectAccount,
      responseMode: this.responseMode,
      responseTypes: this.responseTypes,
      state: this.state,
      status: this.status,
      uiLocales: this.uiLocales,
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
