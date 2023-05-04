import {
  LevelOfAssurance,
  LindormScope,
  OpenIdClientType,
  OpenIdDisplayMode,
  OpenIdGrantType,
  OpenIdResponseMode,
  OpenIdResponseType,
  OpenIdScope,
  Optional,
  ScopeDescription,
} from "@lindorm-io/common-types";
import { EntityAttributes, EntityKeys, JOI_ENTITY_BASE, LindormEntity } from "@lindorm-io/entity";
import Joi from "joi";
import {
  JOI_ARGON_STRING,
  JOI_CLIENT_TYPE,
  JOI_LEVEL_OF_ASSURANCE,
  JOI_SCOPE_DESCRIPTION,
} from "../common";
import {
  JOI_DISPLAY_MODE,
  JOI_EXPIRY_REGEX,
  JOI_GRANT_TYPE,
  JOI_RESPONSE_MODE,
  JOI_RESPONSE_TYPE,
} from "../constant";

export type ClientAllowed = {
  grantTypes: Array<OpenIdGrantType>;
  responseTypes: Array<OpenIdResponseType>;
  scopes: Array<OpenIdScope | LindormScope>;
};

export type ClientAudiences = {
  credentials: Array<string>;
  identity: Array<string>;
};

export type ClientDefaults = {
  displayMode: OpenIdDisplayMode;
  levelOfAssurance: LevelOfAssurance;
  responseMode: OpenIdResponseMode;
};

export type ClientExpiry = {
  accessToken: string;
  idToken: string;
  refreshToken: string;
};

export type ClientAttributes = EntityAttributes & {
  active: boolean;
  allowed: ClientAllowed;
  audiences: ClientAudiences;
  backChannelLogoutUri: string | null;
  claimsUri: string | null;
  defaults: ClientDefaults;
  description: string | null;
  enforceBasicAuth: boolean;
  enforceSecret: boolean;
  expiry: ClientExpiry;
  frontChannelLogoutUri: string | null;
  host: string;
  logoUri: string | null;
  name: string;
  opaqueAccessToken: boolean;
  opaqueRefreshToken: boolean;
  postLogoutUris: Array<string>;
  redirectUris: Array<string>;
  requiredScopes: Array<OpenIdScope | LindormScope>;
  rtbfUri: string | null;
  scopeDescriptions: Array<ScopeDescription>;
  secret: string;
  singleSignOn: boolean;
  tenantId: string;
  type: OpenIdClientType;
};

export type ClientOptions = Optional<
  ClientAttributes,
  | EntityKeys
  | "backChannelLogoutUri"
  | "claimsUri"
  | "description"
  | "enforceBasicAuth"
  | "enforceSecret"
  | "frontChannelLogoutUri"
  | "logoUri"
  | "opaqueAccessToken"
  | "opaqueRefreshToken"
  | "postLogoutUris"
  | "redirectUris"
  | "requiredScopes"
  | "rtbfUri"
  | "scopeDescriptions"
>;

const schema = Joi.object<ClientAttributes>()
  .keys({
    ...JOI_ENTITY_BASE,

    allowed: Joi.object()
      .keys({
        grantTypes: Joi.array().items(JOI_GRANT_TYPE).required(),
        responseTypes: Joi.array().items(JOI_RESPONSE_TYPE).required(),
        scopes: Joi.array().items(Joi.string()).required(),
      })
      .required(),
    audiences: Joi.object()
      .keys({
        credentials: Joi.array().items(Joi.string().guid()).required(),
        identity: Joi.array().items(Joi.string().guid()).required(),
      })
      .required(),
    defaults: Joi.object()
      .keys({
        audiences: Joi.array().items(Joi.string().guid()).required(),
        displayMode: JOI_DISPLAY_MODE.required(),
        levelOfAssurance: JOI_LEVEL_OF_ASSURANCE.required(),
        responseMode: JOI_RESPONSE_MODE.required(),
      })
      .required(),
    expiry: Joi.object()
      .keys({
        accessToken: JOI_EXPIRY_REGEX.required(),
        idToken: JOI_EXPIRY_REGEX.required(),
        refreshToken: JOI_EXPIRY_REGEX.required(),
      })
      .required(),

    active: Joi.boolean().required(),
    backChannelLogoutUri: Joi.string().uri().required(),
    claimsUri: Joi.string().uri().allow(null).required(),
    description: Joi.string().allow(null).required(),
    enforceBasicAuth: Joi.boolean().required(),
    enforceSecret: Joi.boolean().required(),
    frontChannelLogoutUri: Joi.string().uri().allow(null).required(),
    host: Joi.string().uri().required(),
    logoUri: Joi.string().uri().allow(null).required(),
    name: Joi.string().required(),
    opaqueAccessToken: Joi.boolean().required(),
    opaqueRefreshToken: Joi.boolean().required(),
    postLogoutUris: Joi.array().items(Joi.string().uri()).required(),
    redirectUris: Joi.array().items(Joi.string().uri()).required(),
    requiredScopes: Joi.array().items(Joi.string()).required(),
    rtbfUri: Joi.string().uri().allow(null).required(),
    scopeDescriptions: Joi.array().items(JOI_SCOPE_DESCRIPTION).required(),
    secret: JOI_ARGON_STRING.required(),
    singleSignOn: Joi.boolean().required(),
    tenantId: Joi.string().guid().required(),
    type: JOI_CLIENT_TYPE.required(),
  })
  .required();

export class Client extends LindormEntity<ClientAttributes> {
  public active: boolean;
  public allowed: ClientAllowed;
  public audiences: ClientAudiences;
  public backChannelLogoutUri: string | null;
  public claimsUri: string | null;
  public defaults: ClientDefaults;
  public description: string | null;
  public enforceBasicAuth: boolean;
  public enforceSecret: boolean;
  public expiry: ClientExpiry;
  public frontChannelLogoutUri: string | null;
  public host: string;
  public logoUri: string | null;
  public name: string;
  public opaqueAccessToken: boolean;
  public opaqueRefreshToken: boolean;
  public postLogoutUris: Array<string>;
  public redirectUris: Array<string>;
  public requiredScopes: Array<OpenIdScope | LindormScope>;
  public rtbfUri: string | null;
  public scopeDescriptions: Array<ScopeDescription>;
  public secret: string;
  public singleSignOn: boolean;
  public tenantId: string;
  public type: OpenIdClientType;

  public constructor(options: ClientOptions) {
    super(options);

    this.active = options.active;
    this.allowed = options.allowed;
    this.audiences = options.audiences;
    this.backChannelLogoutUri = options.backChannelLogoutUri || null;
    this.claimsUri = options.claimsUri || null;
    this.defaults = options.defaults;
    this.description = options.description || null;
    this.enforceBasicAuth = options.enforceBasicAuth === true;
    this.enforceSecret = options.enforceSecret === true;
    this.expiry = options.expiry;
    this.frontChannelLogoutUri = options.frontChannelLogoutUri || null;
    this.host = options.host;
    this.logoUri = options.logoUri || null;
    this.name = options.name;
    this.opaqueAccessToken = options.opaqueAccessToken !== false;
    this.opaqueRefreshToken = options.opaqueRefreshToken !== false;
    this.postLogoutUris = options.postLogoutUris || [];
    this.redirectUris = options.redirectUris || [];
    this.requiredScopes = options.requiredScopes || [];
    this.rtbfUri = options.rtbfUri || null;
    this.scopeDescriptions = options.scopeDescriptions || [];
    this.secret = options.secret;
    this.singleSignOn = options.singleSignOn === true;
    this.tenantId = options.tenantId;
    this.type = options.type;
  }

  public async schemaValidation(): Promise<void> {
    await schema.validateAsync(this.toJSON());
  }

  public toJSON(): ClientAttributes {
    return {
      ...this.defaultJSON(),

      active: this.active,
      allowed: this.allowed,
      audiences: this.audiences,
      backChannelLogoutUri: this.backChannelLogoutUri,
      claimsUri: this.claimsUri,
      defaults: this.defaults,
      description: this.description,
      enforceBasicAuth: this.enforceBasicAuth,
      enforceSecret: this.enforceSecret,
      expiry: this.expiry,
      frontChannelLogoutUri: this.frontChannelLogoutUri,
      host: this.host,
      logoUri: this.logoUri,
      name: this.name,
      opaqueAccessToken: this.opaqueAccessToken,
      opaqueRefreshToken: this.opaqueRefreshToken,
      postLogoutUris: this.postLogoutUris,
      redirectUris: this.redirectUris,
      requiredScopes: this.requiredScopes,
      rtbfUri: this.rtbfUri,
      scopeDescriptions: this.scopeDescriptions,
      secret: this.secret,
      singleSignOn: this.singleSignOn,
      tenantId: this.tenantId,
      type: this.type,
    };
  }
}
