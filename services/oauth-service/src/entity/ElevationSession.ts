import Joi from "joi";
import { JOI_DISPLAY_MODE } from "../constant";
import { randomString } from "@lindorm-io/random";
import {
  AuthenticationMethod,
  LevelOfAssurance,
  OauthDisplayMode,
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

type ConfirmedAuthentication = {
  latestAuthentication: Date | null;
  levelOfAssurance: LevelOfAssurance;
  methods: Array<AuthenticationMethod>;
};

type RequestedAuthentication = {
  minimumLevel: LevelOfAssurance;
  recommendedLevel: LevelOfAssurance;
  recommendedMethods: Array<AuthenticationMethod>;
  requiredLevel: LevelOfAssurance;
  requiredMethods: Array<AuthenticationMethod>;
};

export type ElevationSessionAttributes = EntityAttributes & {
  confirmedAuthentication: ConfirmedAuthentication;
  requestedAuthentication: RequestedAuthentication;

  accessSessionId: string | null;
  authenticationHint: Array<string>;
  browserSessionId: string | null;
  clientId: string;
  country: string | null;
  displayMode: OauthDisplayMode;
  expires: Date;
  idTokenHint: string | null;
  identityId: string;
  nonce: string;
  redirectUri: string | null;
  refreshSessionId: string | null;
  state: string | null;
  status: SessionStatus;
  uiLocales: Array<string>;
};

export type ElevationSessionOptions = Optional<
  ElevationSessionAttributes,
  | EntityKeys
  | "accessSessionId"
  | "authenticationHint"
  | "browserSessionId"
  | "confirmedAuthentication"
  | "country"
  | "displayMode"
  | "idTokenHint"
  | "nonce"
  | "redirectUri"
  | "refreshSessionId"
  | "requestedAuthentication"
  | "state"
  | "status"
  | "uiLocales"
>;

const schema = Joi.object<ElevationSessionAttributes>()
  .keys({
    ...JOI_ENTITY_BASE,

    confirmedAuthentication: Joi.object<ConfirmedAuthentication>()
      .keys({
        latestAuthentication: Joi.date().allow(null).required(),
        levelOfAssurance: JOI_LEVEL_OF_ASSURANCE.required(),
        methods: Joi.array().items(Joi.string()).required(),
      })
      .required(),
    requestedAuthentication: Joi.object<RequestedAuthentication>()
      .keys({
        minimumLevel: JOI_LEVEL_OF_ASSURANCE.required(),
        recommendedLevel: JOI_LEVEL_OF_ASSURANCE.required(),
        recommendedMethods: Joi.array().items(Joi.string().lowercase()).required(),
        requiredLevel: JOI_LEVEL_OF_ASSURANCE.required(),
        requiredMethods: Joi.array().items(Joi.string().lowercase()).required(),
      })
      .required(),

    accessSessionId: Joi.string().guid().allow(null).required(),
    authenticationHint: Joi.array().items(Joi.string()).required(),
    browserSessionId: Joi.string().guid().allow(null).required(),
    clientId: Joi.string().guid().required(),
    country: JOI_COUNTRY_CODE.allow(null).required(),
    displayMode: JOI_DISPLAY_MODE.required(),
    expires: Joi.date().required(),
    idTokenHint: JOI_JWT.allow(null).required(),
    identityId: Joi.string().guid().required(),
    nonce: JOI_NONCE.required(),
    redirectUri: Joi.string().uri().allow(null).required(),
    refreshSessionId: Joi.string().guid().allow(null).required(),
    state: JOI_STATE.allow(null).required(),
    status: JOI_SESSION_STATUS.required(),
    uiLocales: Joi.array().items(JOI_LOCALE).required(),
  })
  .required();

export class ElevationSession extends LindormEntity<ElevationSessionAttributes> {
  public readonly confirmedAuthentication: ConfirmedAuthentication;
  public readonly requestedAuthentication: RequestedAuthentication;

  public readonly accessSessionId: string | null;
  public readonly authenticationHint: Array<string>;
  public readonly browserSessionId: string | null;
  public readonly clientId: string;
  public readonly country: string | null;
  public readonly displayMode: OauthDisplayMode;
  public readonly expires: Date;
  public readonly idTokenHint: string | null;
  public readonly identityId: string;
  public readonly nonce: string;
  public readonly redirectUri: string | null;
  public readonly refreshSessionId: string | null;
  public readonly state: string | null;
  public readonly uiLocales: Array<string>;

  public status: SessionStatus;

  public constructor(options: ElevationSessionOptions) {
    super(options);

    this.confirmedAuthentication = {
      latestAuthentication: options.confirmedAuthentication?.latestAuthentication || null,
      levelOfAssurance: options.confirmedAuthentication?.levelOfAssurance || 0,
      methods: options.confirmedAuthentication?.methods || [],
    };
    this.requestedAuthentication = {
      minimumLevel:
        options.requestedAuthentication?.minimumLevel &&
        options.requestedAuthentication.minimumLevel > 0
          ? options.requestedAuthentication?.minimumLevel
          : 1,
      recommendedLevel: options.requestedAuthentication?.recommendedLevel || 1,
      recommendedMethods: options.requestedAuthentication?.recommendedMethods || [],
      requiredLevel: options.requestedAuthentication?.requiredLevel || 1,
      requiredMethods: options.requestedAuthentication?.requiredMethods || [],
    };

    this.accessSessionId = options.accessSessionId || null;
    this.browserSessionId = options.browserSessionId || null;
    this.refreshSessionId = options.refreshSessionId || null;
    this.authenticationHint = options.authenticationHint || [];
    this.clientId = options.clientId;
    this.country = options.country || null;
    this.displayMode = options.displayMode || "page";
    this.expires = options.expires;
    this.idTokenHint = options.idTokenHint || null;
    this.identityId = options.identityId;
    this.nonce = options.nonce || randomString(16);
    this.redirectUri = options.redirectUri || null;
    this.state = options.state || null;
    this.status = options.status || SessionStatuses.PENDING;
    this.uiLocales = options.uiLocales || [];
  }

  public async schemaValidation(): Promise<void> {
    await schema.validateAsync(this.toJSON());
  }

  public toJSON(): ElevationSessionAttributes {
    return {
      ...this.defaultJSON(),

      accessSessionId: this.accessSessionId,
      authenticationHint: this.authenticationHint,
      browserSessionId: this.browserSessionId,
      clientId: this.clientId,
      confirmedAuthentication: this.confirmedAuthentication,
      country: this.country,
      displayMode: this.displayMode,
      expires: this.expires,
      idTokenHint: this.idTokenHint,
      identityId: this.identityId,
      nonce: this.nonce,
      redirectUri: this.redirectUri,
      refreshSessionId: this.refreshSessionId,
      requestedAuthentication: this.requestedAuthentication,
      state: this.state,
      status: this.status,
      uiLocales: this.uiLocales,
    };
  }
}
