import {
  AuthenticationFactor,
  AuthenticationMethod,
  AuthenticationStrategy,
  LevelOfAssurance,
  OpenIdDisplayMode,
  SessionStatus,
} from "@lindorm-io/common-types";
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
import { JOI_DISPLAY_MODE } from "../constant";

type ConfirmedAuthentication = {
  factors: Array<AuthenticationFactor>;
  latestAuthentication: Date | null;
  levelOfAssurance: LevelOfAssurance;
  metadata: Record<string, any>;
  methods: Array<AuthenticationMethod>;
  strategies: Array<AuthenticationStrategy>;
};

type RequestedAuthentication = {
  factors: Array<AuthenticationFactor>;
  levelOfAssurance: LevelOfAssurance;
  methods: Array<AuthenticationMethod>;
  minimumLevelOfAssurance: LevelOfAssurance;
  strategies: Array<AuthenticationStrategy>;
};

export type ElevationSessionAttributes = EntityAttributes & {
  confirmedAuthentication: ConfirmedAuthentication;
  requestedAuthentication: RequestedAuthentication;

  authenticationHint: Array<string>;
  browserSessionId: string | null;
  clientId: string;
  country: string | null;
  displayMode: OpenIdDisplayMode;
  expires: Date;
  idTokenHint: string | null;
  identityId: string;
  nonce: string;
  redirectUri: string | null;
  clientSessionId: string | null;
  state: string | null;
  status: SessionStatus;
  uiLocales: Array<string>;
};

export type ElevationSessionOptions = Optional<
  ElevationSessionAttributes,
  | EntityKeys
  | "authenticationHint"
  | "browserSessionId"
  | "confirmedAuthentication"
  | "country"
  | "displayMode"
  | "idTokenHint"
  | "nonce"
  | "redirectUri"
  | "clientSessionId"
  | "state"
  | "status"
  | "uiLocales"
>;

const schema = Joi.object<ElevationSessionAttributes>()
  .keys({
    ...JOI_ENTITY_BASE,

    confirmedAuthentication: Joi.object<ConfirmedAuthentication>()
      .keys({
        factors: Joi.array().items(Joi.string().lowercase()).required(),
        latestAuthentication: Joi.date().allow(null).required(),
        levelOfAssurance: JOI_LEVEL_OF_ASSURANCE.required(),
        metadata: Joi.object().required(),
        methods: Joi.array().items(Joi.string()).required(),
        strategies: Joi.array().items(Joi.string().lowercase()).required(),
      })
      .required(),
    requestedAuthentication: Joi.object<RequestedAuthentication>()
      .keys({
        factors: Joi.array().items(Joi.string().lowercase()).required(),
        levelOfAssurance: JOI_LEVEL_OF_ASSURANCE.required(),
        methods: Joi.array().items(Joi.string()).required(),
        minimumLevelOfAssurance: JOI_LEVEL_OF_ASSURANCE.required(),
        strategies: Joi.array().items(Joi.string().lowercase()).required(),
      })
      .required(),

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
    clientSessionId: Joi.string().guid().allow(null).required(),
    state: JOI_STATE.allow(null).required(),
    status: JOI_SESSION_STATUS.required(),
    uiLocales: Joi.array().items(JOI_LOCALE).required(),
  })
  .required();

export class ElevationSession extends LindormEntity<ElevationSessionAttributes> {
  public readonly confirmedAuthentication: ConfirmedAuthentication;
  public readonly requestedAuthentication: RequestedAuthentication;

  public readonly authenticationHint: Array<string>;
  public readonly browserSessionId: string | null;
  public readonly clientId: string;
  public readonly country: string | null;
  public readonly displayMode: OpenIdDisplayMode;
  public readonly expires: Date;
  public readonly idTokenHint: string | null;
  public readonly identityId: string;
  public readonly nonce: string;
  public readonly redirectUri: string | null;
  public readonly clientSessionId: string | null;
  public readonly state: string | null;
  public readonly uiLocales: Array<string>;

  public status: SessionStatus;

  public constructor(options: ElevationSessionOptions) {
    super(options);

    this.confirmedAuthentication = {
      factors: options.confirmedAuthentication?.factors || [],
      latestAuthentication: options.confirmedAuthentication?.latestAuthentication || null,
      levelOfAssurance: options.confirmedAuthentication?.levelOfAssurance || 0,
      metadata: options.confirmedAuthentication?.metadata || {},
      methods: options.confirmedAuthentication?.methods || [],
      strategies: options.confirmedAuthentication?.strategies || [],
    };
    this.requestedAuthentication = {
      factors: options.requestedAuthentication.factors,
      levelOfAssurance: options.requestedAuthentication.levelOfAssurance,
      methods: options.requestedAuthentication.methods,
      minimumLevelOfAssurance: options.requestedAuthentication.minimumLevelOfAssurance,
      strategies: options.requestedAuthentication.strategies,
    };

    this.browserSessionId = options.browserSessionId || null;
    this.clientSessionId = options.clientSessionId || null;
    this.authenticationHint = options.authenticationHint || [];
    this.clientId = options.clientId;
    this.country = options.country || null;
    this.displayMode = options.displayMode || OpenIdDisplayMode.PAGE;
    this.expires = options.expires;
    this.idTokenHint = options.idTokenHint || null;
    this.identityId = options.identityId;
    this.nonce = options.nonce || randomUnreserved(16);
    this.redirectUri = options.redirectUri || null;
    this.state = options.state || null;
    this.status = options.status || SessionStatus.PENDING;
    this.uiLocales = options.uiLocales || [];
  }

  public async schemaValidation(): Promise<void> {
    await schema.validateAsync(this.toJSON());
  }

  public toJSON(): ElevationSessionAttributes {
    return {
      ...this.defaultJSON(),

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
      clientSessionId: this.clientSessionId,
      requestedAuthentication: this.requestedAuthentication,
      state: this.state,
      status: this.status,
      uiLocales: this.uiLocales,
    };
  }
}
