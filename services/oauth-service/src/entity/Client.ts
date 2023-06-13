import {
  AuthenticationMethod,
  AuthenticationStrategy,
  LevelOfAssurance,
  OpenIdClientProfile,
  OpenIdClientType,
  OpenIdDisplayMode,
  OpenIdGrantType,
  OpenIdResponseMode,
  OpenIdResponseType,
  Optional,
  ScopeDescription,
} from "@lindorm-io/common-types";
import { EntityAttributes, EntityKeys, JOI_ENTITY_BASE, LindormEntity } from "@lindorm-io/entity";
import { Algorithm } from "@lindorm-io/key-pair";
import { ReadableTime } from "@lindorm-io/readable-time";
import Joi from "joi";
import { JOI_ARGON_STRING, JOI_LEVEL_OF_ASSURANCE, JOI_SCOPE_DESCRIPTION } from "../common";
import {
  JOI_DISPLAY_MODE,
  JOI_EXPIRY_REGEX,
  JOI_GRANT_TYPE,
  JOI_RESPONSE_MODE,
  JOI_RESPONSE_TYPE,
} from "../constant";
import { Scope } from "../types";

export type ClientAllowed = {
  grantTypes: Array<OpenIdGrantType>;
  methods: Array<AuthenticationMethod>;
  responseTypes: Array<OpenIdResponseType>;
  scopes: Array<Scope>;
  strategies: Array<AuthenticationStrategy>;
};

export type ClientAuthenticationAssertion = {
  algorithm: Algorithm | null;
  issuer: string | null;
  secret: string | null;
};

export type ClientAuthorizationAssertion = {
  algorithm: Algorithm | null;
  issuer: string | null;
  secret: string | null;
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
  accessToken: ReadableTime;
  idToken: ReadableTime;
  refreshToken: ReadableTime;
};

export type ClientAttributes = EntityAttributes & {
  active: boolean;
  allowed: ClientAllowed;
  audiences: ClientAudiences;
  authenticationAssertion: ClientAuthenticationAssertion;
  authorizationAssertion: ClientAuthorizationAssertion;
  backChannelLogoutUri: string | null;
  claimsUri: string | null;
  defaults: ClientDefaults;
  description: string | null;
  domain: string;
  expiry: ClientExpiry;
  frontChannelLogoutUri: string | null;
  logoUri: string | null;
  name: string;
  opaqueAccessToken: boolean;
  postLogoutUris: Array<string>;
  profile: OpenIdClientProfile;
  redirectUris: Array<string>;
  requiredScopes: Array<Scope>;
  rtbfUri: string | null;
  scopeDescriptions: Array<ScopeDescription>;
  secret: string;
  singleSignOn: boolean;
  tenantId: string;
  trusted: boolean;
  type: OpenIdClientType;
};

export type ClientOptions = Optional<
  ClientAttributes,
  | EntityKeys
  | "active"
  | "backChannelLogoutUri"
  | "claimsUri"
  | "description"
  | "frontChannelLogoutUri"
  | "logoUri"
  | "opaqueAccessToken"
  | "postLogoutUris"
  | "redirectUris"
  | "requiredScopes"
  | "rtbfUri"
  | "scopeDescriptions"
  | "trusted"
>;

const schema = Joi.object<ClientAttributes>()
  .keys({
    ...JOI_ENTITY_BASE,

    allowed: Joi.object()
      .keys({
        grantTypes: Joi.array().items(JOI_GRANT_TYPE).required(),
        methods: Joi.array().items(Joi.string()).required(),
        responseTypes: Joi.array().items(JOI_RESPONSE_TYPE).required(),
        scopes: Joi.array().items(Joi.string()).required(),
        strategies: Joi.array().items(Joi.string()).required(),
      })
      .required(),
    audiences: Joi.object()
      .keys({
        credentials: Joi.array().items(Joi.string().guid()).required(),
        identity: Joi.array().items(Joi.string().guid()).required(),
      })
      .required(),
    authenticationAssertion: Joi.object()
      .keys({
        algorithm: Joi.string()
          .valid(...Object.values(Algorithm))
          .allow(null)
          .required(),
        issuer: Joi.string().allow(null).required(),
        secret: Joi.string().allow(null).required(),
      })
      .required(),
    authorizationAssertion: Joi.object()
      .keys({
        algorithm: Joi.string()
          .valid(...Object.values(Algorithm))
          .allow(null)
          .required(),
        issuer: Joi.string().allow(null).required(),
        secret: Joi.string().allow(null).required(),
      })
      .required(),
    defaults: Joi.object()
      .keys({
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
    claimsUri: Joi.string().uri().required(),
    description: Joi.string().allow(null).required(),
    domain: Joi.string().uri().required(),
    frontChannelLogoutUri: Joi.string().uri().allow(null).required(),
    logoUri: Joi.string().uri().allow(null).required(),
    name: Joi.string().required(),
    opaqueAccessToken: Joi.boolean().required(),
    postLogoutUris: Joi.array().items(Joi.string().uri()).required(),
    redirectUris: Joi.array().items(Joi.string().uri()).required(),
    requiredScopes: Joi.array().items(Joi.string()).required(),
    rtbfUri: Joi.string().uri().allow(null).required(),
    scopeDescriptions: Joi.array().items(JOI_SCOPE_DESCRIPTION).required(),
    secret: JOI_ARGON_STRING.required(),
    singleSignOn: Joi.boolean().required(),
    tenantId: Joi.string().guid().required(),
    type: Joi.string()
      .valid(...Object.values(OpenIdClientType))
      .required(),
    profile: Joi.string()
      .valid(...Object.values(OpenIdClientProfile))
      .required(),
    trusted: Joi.boolean().required(),
  })
  .required();

export class Client extends LindormEntity<ClientAttributes> {
  public active: boolean;
  public allowed: ClientAllowed;
  public audiences: ClientAudiences;
  public authenticationAssertion: ClientAuthenticationAssertion;
  public authorizationAssertion: ClientAuthorizationAssertion;
  public backChannelLogoutUri: string | null;
  public claimsUri: string | null;
  public defaults: ClientDefaults;
  public description: string | null;
  public expiry: ClientExpiry;
  public frontChannelLogoutUri: string | null;
  public domain: string;
  public logoUri: string | null;
  public name: string;
  public opaqueAccessToken: boolean;
  public postLogoutUris: Array<string>;
  public profile: OpenIdClientProfile;
  public redirectUris: Array<string>;
  public requiredScopes: Array<Scope>;
  public rtbfUri: string | null;
  public scopeDescriptions: Array<ScopeDescription>;
  public secret: string;
  public singleSignOn: boolean;
  public tenantId: string;
  public trusted: boolean;
  public type: OpenIdClientType;

  public constructor(options: ClientOptions) {
    super(options);

    this.active = options.active === true;
    this.allowed = options.allowed;
    this.audiences = options.audiences;
    this.authenticationAssertion = options.authenticationAssertion;
    this.authorizationAssertion = options.authorizationAssertion;
    this.backChannelLogoutUri = options.backChannelLogoutUri || null;
    this.claimsUri = options.claimsUri || null;
    this.defaults = options.defaults;
    this.description = options.description || null;
    this.domain = options.domain;
    this.expiry = options.expiry;
    this.frontChannelLogoutUri = options.frontChannelLogoutUri || null;
    this.logoUri = options.logoUri || null;
    this.name = options.name;
    this.opaqueAccessToken = options.opaqueAccessToken === true;
    this.postLogoutUris = options.postLogoutUris || [];
    this.profile = options.profile;
    this.redirectUris = options.redirectUris || [];
    this.requiredScopes = options.requiredScopes || [];
    this.rtbfUri = options.rtbfUri || null;
    this.scopeDescriptions = options.scopeDescriptions || [];
    this.secret = options.secret;
    this.singleSignOn = options.singleSignOn === true;
    this.tenantId = options.tenantId;
    this.trusted = options.trusted === true;
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
      authenticationAssertion: this.authenticationAssertion,
      authorizationAssertion: this.authorizationAssertion,
      backChannelLogoutUri: this.backChannelLogoutUri,
      claimsUri: this.claimsUri,
      defaults: this.defaults,
      description: this.description,
      domain: this.domain,
      expiry: this.expiry,
      frontChannelLogoutUri: this.frontChannelLogoutUri,
      logoUri: this.logoUri,
      name: this.name,
      opaqueAccessToken: this.opaqueAccessToken,
      postLogoutUris: this.postLogoutUris,
      profile: this.profile,
      redirectUris: this.redirectUris,
      requiredScopes: this.requiredScopes,
      rtbfUri: this.rtbfUri,
      scopeDescriptions: this.scopeDescriptions,
      secret: this.secret,
      singleSignOn: this.singleSignOn,
      tenantId: this.tenantId,
      trusted: this.trusted,
      type: this.type,
    };
  }
}
