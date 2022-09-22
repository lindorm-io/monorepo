import Joi from "joi";
import { LevelOfAssurance } from "@lindorm-io/jwt";
import { PKCEMethod } from "@lindorm-io/core";
import {
  EntityAttributes,
  EntityKeys,
  JOI_ENTITY_BASE,
  LindormEntity,
  Optional,
} from "@lindorm-io/entity";
import {
  AuthenticationMethod,
  DisplayMode,
  JOI_COUNTRY_CODE,
  JOI_GUID,
  JOI_JWT,
  JOI_LEVEL_OF_ASSURANCE,
  JOI_LOCALE,
  JOI_NONCE,
  JOI_SESSION_STATUS,
  JOI_STATE,
  PromptMode,
  ResponseMode,
  ResponseType,
  SessionStatus,
} from "../common";
import {
  JOI_CODE_CHALLENGE,
  JOI_DISPLAY_MODE,
  JOI_PKCE_METHOD,
  JOI_PROMPT_MODE,
  JOI_RESPONSE_MODE,
  JOI_RESPONSE_TYPE,
} from "../constant";

type AuthorizationSessionCode = {
  codeChallenge: string | null;
  codeChallengeMethod: PKCEMethod | null;
};

type AuthorizationSessionConfirmedConsent = {
  audiences: Array<string>;
  scopes: Array<string>;
};

type AuthorizationSessionConfirmedLogin = {
  acrValues: Array<string>;
  amrValues: Array<AuthenticationMethod>;
  identityId: string | null;
  latestAuthentication: Date | null;
  levelOfAssurance: LevelOfAssurance;
  remember: boolean;
};

type AuthorizationSessionIdentifiers = {
  browserSessionId: string | null;
  consentSessionId: string | null;
  refreshSessionId: string | null;
};

type AuthorizationSessionRequestedConsent = {
  audiences: Array<string>;
  scopes: Array<string>;
};

type AuthorizationSessionRequestedLogin = {
  authenticationMethods: Array<AuthenticationMethod>;
  identityId: string | null;
  levelHint: LevelOfAssurance;
  levelOfAssurance: LevelOfAssurance;
  methodHint: Array<AuthenticationMethod>;
};

type AuthorizationSessionStatus = {
  consent: SessionStatus;
  login: SessionStatus;
};

export interface AuthorizationSessionAttributes extends EntityAttributes {
  code: AuthorizationSessionCode;
  confirmedConsent: AuthorizationSessionConfirmedConsent;
  confirmedLogin: AuthorizationSessionConfirmedLogin;
  identifiers: AuthorizationSessionIdentifiers;
  requestedConsent: AuthorizationSessionRequestedConsent;
  requestedLogin: AuthorizationSessionRequestedLogin;
  status: AuthorizationSessionStatus;

  authToken: string | null;
  clientId: string;
  country: string | null;
  displayMode: DisplayMode;
  expires: Date;
  idTokenHint: string | null;
  loginHint: Array<string>;
  maxAge: number | null;
  nonce: string | null;
  originalUri: string;
  promptModes: Array<PromptMode>;
  redirectData: string | null;
  redirectUri: string;
  responseMode: ResponseMode;
  responseTypes: Array<ResponseType>;
  state: string;
  uiLocales: Array<string>;
}

export type AuthorizationSessionOptions = Optional<
  AuthorizationSessionAttributes,
  | EntityKeys
  | "authToken"
  | "code"
  | "confirmedConsent"
  | "confirmedLogin"
  | "country"
  | "displayMode"
  | "idTokenHint"
  | "identifiers"
  | "loginHint"
  | "maxAge"
  | "nonce"
  | "promptModes"
  | "redirectData"
  | "requestedConsent"
  | "requestedLogin"
  | "responseMode"
  | "status"
  | "uiLocales"
>;

const schema = Joi.object<AuthorizationSessionAttributes>()
  .keys({
    ...JOI_ENTITY_BASE,

    code: Joi.object<AuthorizationSessionCode>()
      .keys({
        codeChallenge: JOI_CODE_CHALLENGE.allow(null).required(),
        codeChallengeMethod: JOI_PKCE_METHOD.allow(null).required(),
      })
      .required(),
    confirmedConsent: Joi.object<AuthorizationSessionConfirmedConsent>()
      .keys({
        audiences: Joi.array().items(JOI_GUID).required(),
        scopes: Joi.array().items(Joi.string().lowercase()).required(),
      })
      .required(),
    confirmedLogin: Joi.object<AuthorizationSessionConfirmedLogin>()
      .keys({
        acrValues: Joi.array().items(Joi.string()).required(),
        amrValues: Joi.array().items(Joi.string()).required(),
        identityId: JOI_GUID.allow(null).required(),
        latestAuthentication: Joi.date().allow(null).required(),
        levelOfAssurance: JOI_LEVEL_OF_ASSURANCE.required(),
        remember: Joi.boolean().required(),
      })
      .required(),
    identifiers: Joi.object<AuthorizationSessionIdentifiers>()
      .keys({
        browserSessionId: JOI_GUID.allow(null).required(),
        consentSessionId: JOI_GUID.allow(null).required(),
        refreshSessionId: JOI_GUID.allow(null).required(),
      })
      .required(),
    requestedConsent: Joi.object<AuthorizationSessionRequestedConsent>()
      .keys({
        audiences: Joi.array().items(JOI_GUID).required(),
        scopes: Joi.array().items(Joi.string().lowercase()).required(),
      })
      .required(),
    requestedLogin: Joi.object<AuthorizationSessionRequestedLogin>()
      .keys({
        authenticationMethods: Joi.array().items(Joi.string().lowercase()).required(),
        identityId: JOI_GUID.allow(null).required(),
        levelHint: JOI_LEVEL_OF_ASSURANCE.required(),
        levelOfAssurance: JOI_LEVEL_OF_ASSURANCE.required(),
        methodHint: Joi.array().items(Joi.string().lowercase()).required(),
      })
      .required(),
    status: Joi.object<AuthorizationSessionStatus>()
      .keys({
        consent: JOI_SESSION_STATUS.required(),
        login: JOI_SESSION_STATUS.required(),
      })
      .required(),

    authToken: JOI_JWT.allow(null).required(),
    clientId: JOI_GUID.required(),
    country: JOI_COUNTRY_CODE.allow(null).required(),
    displayMode: JOI_DISPLAY_MODE.required(),
    expires: Joi.date().required(),
    idTokenHint: JOI_JWT.allow(null).required(),
    loginHint: Joi.array().items(Joi.string().lowercase()).required(),
    maxAge: Joi.number().allow(null).required(),
    nonce: JOI_NONCE.allow(null).required(),
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

export class AuthorizationSession extends LindormEntity<AuthorizationSessionAttributes> {
  public readonly code: AuthorizationSessionCode;
  public readonly confirmedConsent: AuthorizationSessionConfirmedConsent;
  public readonly confirmedLogin: AuthorizationSessionConfirmedLogin;
  public readonly identifiers: AuthorizationSessionIdentifiers;
  public readonly requestedConsent: AuthorizationSessionRequestedConsent;
  public readonly requestedLogin: AuthorizationSessionRequestedLogin;
  public readonly status: AuthorizationSessionStatus;

  public readonly authToken: string | null;
  public readonly clientId: string;
  public readonly country: string | null;
  public readonly displayMode: DisplayMode;
  public readonly expires: Date;
  public readonly idTokenHint: string | null;
  public readonly loginHint: Array<string>;
  public readonly maxAge: number | null;
  public readonly nonce: string | null;
  public readonly originalUri: string;
  public readonly promptModes: Array<PromptMode>;
  public readonly redirectData: string | null;
  public readonly redirectUri: string;
  public readonly responseMode: ResponseMode;
  public readonly responseTypes: Array<ResponseType>;
  public readonly state: string;
  public readonly uiLocales: Array<string>;

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
      acrValues: options.confirmedLogin?.acrValues || [],
      amrValues: options.confirmedLogin?.amrValues || [],
      identityId: options.confirmedLogin?.identityId || null,
      latestAuthentication: options.confirmedLogin?.latestAuthentication || null,
      levelOfAssurance: options.confirmedLogin?.levelOfAssurance || 0,
      remember: options.confirmedLogin?.remember === true,
    };
    this.identifiers = {
      browserSessionId: options.identifiers?.browserSessionId || null,
      consentSessionId: options.identifiers?.consentSessionId || null,
      refreshSessionId: options.identifiers?.refreshSessionId || null,
    };
    this.requestedConsent = {
      audiences: options.requestedConsent?.audiences || [],
      scopes: options.requestedConsent?.scopes || [],
    };
    this.requestedLogin = {
      authenticationMethods: options.requestedLogin?.authenticationMethods || [],
      identityId: options.requestedLogin?.identityId || null,
      levelHint: options.requestedLogin?.levelHint || 0,
      levelOfAssurance: options.requestedLogin?.levelOfAssurance || 1,
      methodHint: options.requestedLogin?.methodHint || [],
    };
    this.status = {
      consent: options.status?.consent || SessionStatus.PENDING,
      login: options.status?.login || SessionStatus.PENDING,
    };

    this.authToken = options.authToken || null;
    this.clientId = options.clientId;
    this.country = options.country || null;
    this.displayMode = options.displayMode || DisplayMode.PAGE;
    this.expires = options.expires;
    this.idTokenHint = options.idTokenHint || null;
    this.loginHint = options.loginHint || [];
    this.maxAge = options.maxAge || null;
    this.nonce = options.nonce || null;
    this.originalUri = options.originalUri;
    this.promptModes = options.promptModes || [];
    this.redirectData = options.redirectData || null;
    this.redirectUri = options.redirectUri;
    this.responseMode = options.responseMode || ResponseMode.QUERY;
    this.responseTypes = options.responseTypes;
    this.state = options.state;
    this.uiLocales = options.uiLocales || [];
  }

  public async schemaValidation(): Promise<void> {
    await schema.validateAsync(this.toJSON());
  }

  public toJSON(): AuthorizationSessionAttributes {
    return {
      ...this.defaultJSON(),

      authToken: this.authToken,
      clientId: this.clientId,
      code: this.code,
      confirmedConsent: this.confirmedConsent,
      confirmedLogin: this.confirmedLogin,
      country: this.country,
      displayMode: this.displayMode,
      expires: this.expires,
      idTokenHint: this.idTokenHint,
      identifiers: this.identifiers,
      loginHint: this.loginHint,
      maxAge: this.maxAge,
      nonce: this.nonce,
      originalUri: this.originalUri,
      promptModes: this.promptModes,
      redirectData: this.redirectData,
      redirectUri: this.redirectUri,
      requestedConsent: this.requestedConsent,
      requestedLogin: this.requestedLogin,
      responseMode: this.responseMode,
      responseTypes: this.responseTypes,
      state: this.state,
      status: this.status,
      uiLocales: this.uiLocales,
    };
  }
}
