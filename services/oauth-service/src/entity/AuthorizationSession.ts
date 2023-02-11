import Joi from "joi";
import {
  AuthenticationMethod,
  LevelOfAssurance,
  OauthDisplayMode,
  OauthDisplayModes,
  OauthPromptMode,
  OauthResponseMode,
  OauthResponseModes,
  OauthResponseType,
  PKCEMethod,
  SessionStatus,
  SessionStatuses,
} from "@lindorm-io/common-types";
import {
  EntityAttributes,
  EntityKeys,
  JOI_ENTITY_BASE,
  LindormEntity,
  Optional,
} from "@lindorm-io/entity";
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
import { randomString } from "@lindorm-io/random";

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
  identityId: string | null;
  minimumLevel: LevelOfAssurance;
  recommendedLevel: LevelOfAssurance;
  recommendedMethods: Array<AuthenticationMethod>;
  requiredLevel: LevelOfAssurance;
  requiredMethods: Array<AuthenticationMethod>;
};

type AuthorizationSessionStatus = {
  consent: SessionStatus;
  login: SessionStatus;
};

export type AuthorizationSessionAttributes = EntityAttributes & {
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
  displayMode: OauthDisplayMode;
  expires: Date;
  idTokenHint: string | null;
  loginHint: Array<string>;
  maxAge: number | null;
  nonce: string;
  originalUri: string;
  promptModes: Array<OauthPromptMode>;
  redirectData: string | null;
  redirectUri: string;
  responseMode: OauthResponseMode;
  responseTypes: Array<OauthResponseType>;
  state: string;
  uiLocales: Array<string>;
};

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
        audiences: Joi.array().items(Joi.string().guid()).required(),
        scopes: Joi.array().items(Joi.string().lowercase()).required(),
      })
      .required(),
    confirmedLogin: Joi.object<AuthorizationSessionConfirmedLogin>()
      .keys({
        acrValues: Joi.array().items(Joi.string()).required(),
        amrValues: Joi.array().items(Joi.string()).required(),
        identityId: Joi.string().guid().allow(null).required(),
        latestAuthentication: Joi.date().allow(null).required(),
        levelOfAssurance: JOI_LEVEL_OF_ASSURANCE.required(),
        remember: Joi.boolean().required(),
      })
      .required(),
    identifiers: Joi.object<AuthorizationSessionIdentifiers>()
      .keys({
        browserSessionId: Joi.string().guid().allow(null).required(),
        consentSessionId: Joi.string().guid().allow(null).required(),
        refreshSessionId: Joi.string().guid().allow(null).required(),
      })
      .required(),
    requestedConsent: Joi.object<AuthorizationSessionRequestedConsent>()
      .keys({
        audiences: Joi.array().items(Joi.string().guid()).required(),
        scopes: Joi.array().items(Joi.string().lowercase()).required(),
      })
      .required(),
    requestedLogin: Joi.object<AuthorizationSessionRequestedLogin>()
      .keys({
        identityId: Joi.string().guid().allow(null).required(),
        minimumLevel: JOI_LEVEL_OF_ASSURANCE.required(),
        recommendedLevel: JOI_LEVEL_OF_ASSURANCE.required(),
        recommendedMethods: Joi.array().items(Joi.string().lowercase()).required(),
        requiredLevel: JOI_LEVEL_OF_ASSURANCE.required(),
        requiredMethods: Joi.array().items(Joi.string().lowercase()).required(),
      })
      .required(),
    status: Joi.object<AuthorizationSessionStatus>()
      .keys({
        consent: JOI_SESSION_STATUS.required(),
        login: JOI_SESSION_STATUS.required(),
      })
      .required(),

    authToken: JOI_JWT.allow(null).required(),
    clientId: Joi.string().guid().required(),
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
  public readonly displayMode: OauthDisplayMode;
  public readonly expires: Date;
  public readonly idTokenHint: string | null;
  public readonly loginHint: Array<string>;
  public readonly maxAge: number | null;
  public readonly nonce: string;
  public readonly originalUri: string;
  public readonly promptModes: Array<OauthPromptMode>;
  public readonly redirectData: string | null;
  public readonly redirectUri: string;
  public readonly responseMode: OauthResponseMode;
  public readonly responseTypes: Array<OauthResponseType>;
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
      identityId: options.requestedLogin?.identityId || null,
      minimumLevel: options.requestedLogin?.minimumLevel || 1,
      recommendedLevel: options.requestedLogin?.recommendedLevel || 1,
      recommendedMethods: options.requestedLogin?.recommendedMethods || [],
      requiredLevel: options.requestedLogin?.requiredLevel || 1,
      requiredMethods: options.requestedLogin?.requiredMethods || [],
    };
    this.status = {
      consent: options.status?.consent || SessionStatuses.PENDING,
      login: options.status?.login || SessionStatuses.PENDING,
    };

    this.authToken = options.authToken || null;
    this.clientId = options.clientId;
    this.country = options.country || null;
    this.displayMode = options.displayMode || OauthDisplayModes.PAGE;
    this.expires = options.expires;
    this.idTokenHint = options.idTokenHint || null;
    this.loginHint = options.loginHint || [];
    this.maxAge = options.maxAge || null;
    this.nonce = options.nonce || randomString(16);
    this.originalUri = options.originalUri;
    this.promptModes = options.promptModes || [];
    this.redirectData = options.redirectData || null;
    this.redirectUri = options.redirectUri;
    this.responseMode = options.responseMode || OauthResponseModes.QUERY;
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
