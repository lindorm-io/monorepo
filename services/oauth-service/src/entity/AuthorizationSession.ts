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
  JOI_CODE,
  JOI_CODE_CHALLENGE,
  JOI_DISPLAY_MODE,
  JOI_PKCE_METHOD,
  JOI_PROMPT_MODE,
  JOI_RESPONSE_MODE,
  JOI_RESPONSE_TYPE,
} from "../constant";

export interface AuthorizationSessionAttributes extends EntityAttributes {
  audiences: Array<string>;
  authToken: string | null;
  authenticationMethods: Array<string>;
  authenticationStatus: SessionStatus;
  browserSessionId: string | null;
  clientId: string;
  code: string | null;
  codeChallenge: string | null;
  codeChallengeMethod: PKCEMethod | null;
  consentSessionId: string | null;
  consentStatus: SessionStatus;
  country: string;
  displayMode: DisplayMode;
  expires: Date;
  idTokenHint: string | null;
  identityId: string | null;
  levelOfAssurance: LevelOfAssurance;
  loginHint: Array<string>;
  maxAge: number | null;
  nonce: string | null;
  originalUri: string;
  promptModes: Array<PromptMode>;
  redirectData: string;
  redirectUri: string;
  refreshSessionId: string;
  responseMode: ResponseMode;
  responseTypes: Array<ResponseType>;
  scopes: Array<string>;
  state: string;
  uiLocales: Array<string>;
}

export type AuthorizationSessionOptions = Optional<
  AuthorizationSessionAttributes,
  | EntityKeys
  | "audiences"
  | "authToken"
  | "authenticationMethods"
  | "authenticationStatus"
  | "browserSessionId"
  | "code"
  | "codeChallenge"
  | "codeChallengeMethod"
  | "consentSessionId"
  | "consentStatus"
  | "country"
  | "displayMode"
  | "idTokenHint"
  | "identityId"
  | "levelOfAssurance"
  | "loginHint"
  | "maxAge"
  | "nonce"
  | "promptModes"
  | "redirectData"
  | "refreshSessionId"
  | "responseMode"
  | "scopes"
  | "uiLocales"
>;

const schema = Joi.object<AuthorizationSessionAttributes>()
  .keys({
    ...JOI_ENTITY_BASE,

    audiences: Joi.array().items(JOI_GUID).required(),
    authToken: JOI_JWT.allow(null).required(),
    authenticationMethods: Joi.array().items(Joi.string().lowercase()).required(),
    authenticationStatus: JOI_SESSION_STATUS.required(),
    browserSessionId: JOI_GUID.allow(null).required(),
    clientId: JOI_GUID.required(),
    code: JOI_CODE.allow(null).required(),
    codeChallenge: JOI_CODE_CHALLENGE.allow(null).required(),
    codeChallengeMethod: JOI_PKCE_METHOD.allow(null).required(),
    consentSessionId: JOI_GUID.allow(null).required(),
    consentStatus: JOI_SESSION_STATUS.required(),
    country: JOI_COUNTRY_CODE.allow(null).required(),
    displayMode: JOI_DISPLAY_MODE.required(),
    expires: Joi.date().required(),
    idTokenHint: JOI_JWT.allow(null).required(),
    identityId: JOI_GUID.allow(null).required(),
    levelOfAssurance: JOI_LEVEL_OF_ASSURANCE.required(),
    loginHint: Joi.array().items(Joi.string().lowercase()).required(),
    maxAge: Joi.number().allow(null).required(),
    nonce: JOI_NONCE.allow(null).required(),
    originalUri: Joi.string().uri().required(),
    promptModes: Joi.array().items(JOI_PROMPT_MODE).required(),
    redirectData: Joi.string().base64().allow(null).required(),
    redirectUri: Joi.string().uri().required(),
    refreshSessionId: JOI_GUID.allow(null).required(),
    responseMode: JOI_RESPONSE_MODE.required(),
    responseTypes: Joi.array().items(JOI_RESPONSE_TYPE).required(),
    scopes: Joi.array().items(Joi.string().lowercase()).required(),
    state: JOI_STATE.required(),
    uiLocales: Joi.array().items(JOI_LOCALE).required(),
  })
  .required();

export class AuthorizationSession extends LindormEntity<AuthorizationSessionAttributes> {
  public readonly audiences: Array<string>;
  public readonly authToken: string | null;
  public readonly authenticationMethods: Array<string>;
  public readonly clientId: string;
  public readonly codeChallenge: string | null;
  public readonly codeChallengeMethod: PKCEMethod | null;
  public readonly country: string;
  public readonly displayMode: DisplayMode;
  public readonly idTokenHint: string | null;
  public readonly identityId: string | null;
  public readonly levelOfAssurance: LevelOfAssurance;
  public readonly loginHint: Array<string>;
  public readonly maxAge: number | null;
  public readonly nonce: string | null;
  public readonly originalUri: string;
  public readonly promptModes: Array<PromptMode>;
  public readonly redirectData: string | null;
  public readonly redirectUri: string;
  public readonly refreshSessionId: string;
  public readonly responseMode: ResponseMode;
  public readonly responseTypes: Array<ResponseType>;
  public readonly scopes: Array<string>;
  public readonly state: string;
  public readonly uiLocales: Array<string>;

  public authenticationStatus: SessionStatus;
  public browserSessionId: string | null;
  public code: string | null;
  public consentSessionId: string | null;
  public consentStatus: SessionStatus;
  public expires: Date;

  public constructor(options: AuthorizationSessionOptions) {
    super(options);

    this.audiences = options.audiences || [];
    this.authToken = options.authToken || null;
    this.authenticationMethods = options.authenticationMethods || [];
    this.authenticationStatus = options.authenticationStatus || SessionStatus.PENDING;
    this.browserSessionId = options.browserSessionId || null;
    this.clientId = options.clientId;
    this.code = options.code || null;
    this.codeChallenge = options.codeChallenge || null;
    this.codeChallengeMethod = options.codeChallengeMethod || null;
    this.consentSessionId = options.consentSessionId || null;
    this.consentStatus = options.consentStatus || SessionStatus.PENDING;
    this.country = options.country || null;
    this.displayMode = options.displayMode || DisplayMode.PAGE;
    this.expires = options.expires;
    this.idTokenHint = options.idTokenHint || null;
    this.identityId = options.identityId || null;
    this.levelOfAssurance = options.levelOfAssurance || 0;
    this.loginHint = options.loginHint || [];
    this.maxAge = options.maxAge || null;
    this.nonce = options.nonce || null;
    this.originalUri = options.originalUri;
    this.promptModes = options.promptModes || [];
    this.redirectData = options.redirectData || null;
    this.redirectUri = options.redirectUri;
    this.refreshSessionId = options.refreshSessionId || null;
    this.responseMode = options.responseMode || ResponseMode.QUERY;
    this.responseTypes = options.responseTypes;
    this.scopes = options.scopes || [];
    this.state = options.state;
    this.uiLocales = options.uiLocales || [];
  }

  public async schemaValidation(): Promise<void> {
    await schema.validateAsync(this.toJSON());
  }

  public toJSON(): AuthorizationSessionAttributes {
    return {
      ...this.defaultJSON(),

      audiences: this.audiences,
      authToken: this.authToken,
      authenticationMethods: this.authenticationMethods,
      authenticationStatus: this.authenticationStatus,
      browserSessionId: this.browserSessionId,
      clientId: this.clientId,
      code: this.code,
      codeChallenge: this.codeChallenge,
      codeChallengeMethod: this.codeChallengeMethod,
      consentSessionId: this.consentSessionId,
      consentStatus: this.consentStatus,
      country: this.country,
      displayMode: this.displayMode,
      expires: this.expires,
      idTokenHint: this.idTokenHint,
      identityId: this.identityId,
      levelOfAssurance: this.levelOfAssurance,
      loginHint: this.loginHint,
      maxAge: this.maxAge,
      nonce: this.nonce,
      originalUri: this.originalUri,
      promptModes: this.promptModes,
      redirectData: this.redirectData,
      redirectUri: this.redirectUri,
      refreshSessionId: this.refreshSessionId,
      responseMode: this.responseMode,
      responseTypes: this.responseTypes,
      scopes: this.scopes,
      state: this.state,
      uiLocales: this.uiLocales,
    };
  }
}
