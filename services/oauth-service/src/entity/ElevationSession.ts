import Joi from "joi";
import {
  AuthenticationMethod,
  LevelOfAssurance,
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

type ElevationSessionConfirmedAuthentication = {
  acrValues: Array<string>;
  amrValues: Array<AuthenticationMethod>;
  latestAuthentication: Date | null;
  levelOfAssurance: LevelOfAssurance;
};

type ElevationSessionIdentifiers = {
  browserSessionId: string | null;
  refreshSessionId: string | null;
};

type ElevationSessionRequestedAuthentication = {
  minimumLevel: LevelOfAssurance;
  recommendedLevel: LevelOfAssurance;
  recommendedMethods: Array<AuthenticationMethod>;
  requiredLevel: LevelOfAssurance;
  requiredMethods: Array<AuthenticationMethod>;
};

export type ElevationSessionAttributes = EntityAttributes & {
  confirmedAuthentication: ElevationSessionConfirmedAuthentication;
  identifiers: ElevationSessionIdentifiers;
  requestedAuthentication: ElevationSessionRequestedAuthentication;

  authenticationHint: Array<string>;
  clientId: string;
  country: string | null;
  expires: Date;
  idTokenHint: string | null;
  identityId: string;
  nonce: string | null;
  redirectUri: string | null;
  state: string | null;
  status: SessionStatus;
  uiLocales: Array<string>;
};

export type ElevationSessionOptions = Optional<
  ElevationSessionAttributes,
  | EntityKeys
  | "authenticationHint"
  | "confirmedAuthentication"
  | "country"
  | "idTokenHint"
  | "identifiers"
  | "nonce"
  | "redirectUri"
  | "requestedAuthentication"
  | "state"
  | "status"
  | "uiLocales"
>;

const schema = Joi.object<ElevationSessionAttributes>()
  .keys({
    ...JOI_ENTITY_BASE,

    confirmedAuthentication: Joi.object<ElevationSessionConfirmedAuthentication>()
      .keys({
        acrValues: Joi.array().items(Joi.string()).required(),
        amrValues: Joi.array().items(Joi.string()).required(),
        latestAuthentication: Joi.date().allow(null).required(),
        levelOfAssurance: JOI_LEVEL_OF_ASSURANCE.required(),
      })
      .required(),
    identifiers: Joi.object<ElevationSessionIdentifiers>()
      .keys({
        browserSessionId: Joi.string().guid().allow(null).required(),
        refreshSessionId: Joi.string().guid().allow(null).required(),
      })
      .required(),
    requestedAuthentication: Joi.object<ElevationSessionRequestedAuthentication>()
      .keys({
        minimumLevel: JOI_LEVEL_OF_ASSURANCE.required(),
        recommendedLevel: JOI_LEVEL_OF_ASSURANCE.required(),
        recommendedMethods: Joi.array().items(Joi.string().lowercase()).required(),
        requiredLevel: JOI_LEVEL_OF_ASSURANCE.required(),
        requiredMethods: Joi.array().items(Joi.string().lowercase()).required(),
      })
      .required(),

    authenticationHint: Joi.array().items(Joi.string()).required(),
    clientId: Joi.string().guid().required(),
    country: JOI_COUNTRY_CODE.allow(null).required(),
    expires: Joi.date().required(),
    idTokenHint: JOI_JWT.allow(null).required(),
    identityId: Joi.string().guid().required(),
    nonce: JOI_NONCE.allow(null).required(),
    redirectUri: Joi.string().uri().allow(null).required(),
    state: JOI_STATE.allow(null).required(),
    status: JOI_SESSION_STATUS.required(),
    uiLocales: Joi.array().items(JOI_LOCALE).required(),
  })
  .required();

export class ElevationSession extends LindormEntity<ElevationSessionAttributes> {
  public readonly confirmedAuthentication: ElevationSessionConfirmedAuthentication;
  public readonly identifiers: ElevationSessionIdentifiers;
  public readonly requestedAuthentication: ElevationSessionRequestedAuthentication;

  public readonly authenticationHint: Array<string>;
  public readonly clientId: string;
  public readonly country: string | null;
  public readonly expires: Date;
  public readonly idTokenHint: string | null;
  public readonly identityId: string;
  public readonly nonce: string | null;
  public readonly redirectUri: string | null;
  public readonly state: string | null;
  public readonly uiLocales: Array<string>;

  public status: SessionStatus;

  public constructor(options: ElevationSessionOptions) {
    super(options);

    this.confirmedAuthentication = {
      acrValues: options.confirmedAuthentication?.acrValues || [],
      amrValues: options.confirmedAuthentication?.amrValues || [],
      latestAuthentication: options.confirmedAuthentication?.latestAuthentication || null,
      levelOfAssurance: options.confirmedAuthentication?.levelOfAssurance || 0,
    };
    this.identifiers = {
      browserSessionId: options.identifiers?.browserSessionId || null,
      refreshSessionId: options.identifiers?.refreshSessionId || null,
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

    this.authenticationHint = options.authenticationHint || [];
    this.clientId = options.clientId;
    this.country = options.country || null;
    this.expires = options.expires;
    this.idTokenHint = options.idTokenHint || null;
    this.identityId = options.identityId;
    this.nonce = options.nonce || null;
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

      authenticationHint: this.authenticationHint,
      clientId: this.clientId,
      confirmedAuthentication: this.confirmedAuthentication,
      country: this.country,
      expires: this.expires,
      idTokenHint: this.idTokenHint,
      identifiers: this.identifiers,
      identityId: this.identityId,
      nonce: this.nonce,
      redirectUri: this.redirectUri,
      requestedAuthentication: this.requestedAuthentication,
      state: this.state,
      status: this.status,
      uiLocales: this.uiLocales,
    };
  }
}
