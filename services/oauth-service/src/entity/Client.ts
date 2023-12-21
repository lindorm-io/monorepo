import { AesAlgorithm, AesEncryptionKeyAlgorithm } from "@lindorm-io/aes";
import {
  AuthenticationMethod,
  AuthenticationStrategy,
  OpenIdBackchannelAuthMode,
  OpenIdClientProfile,
  OpenIdClientType,
  OpenIdDisplayMode,
  OpenIdGrantType,
  OpenIdResponseMode,
  OpenIdResponseType,
  PKCEMethod,
  Scope,
} from "@lindorm-io/common-enums";
import { LevelOfAssurance, Optional, ScopeDescription } from "@lindorm-io/common-types";
import { EntityAttributes, EntityKeys, JOI_ENTITY_BASE, LindormEntity } from "@lindorm-io/entity";
import { KeyPairAlgorithm } from "@lindorm-io/key-pair";
import { ReadableTime } from "@lindorm-io/readable-time";
import Joi from "joi";
import { JOI_ARGON_STRING, JOI_SCOPE_DESCRIPTION } from "../common";
import { JOI_EXPIRY_REGEX } from "../constant";

export type ClientAllowed = {
  codeChallengeMethods: Array<PKCEMethod>;
  grantTypes: Array<OpenIdGrantType>;
  methods: Array<AuthenticationMethod>;
  responseTypes: Array<OpenIdResponseType>;
  scopes: Array<Scope | string>;
  strategies: Array<AuthenticationStrategy>;
};

export type ClientAuthenticationAssertion = {
  algorithm: KeyPairAlgorithm | null;
  issuer: string | null;
  secret: string | null;
};

export type ClientAuthorizationAssertion = {
  algorithm: KeyPairAlgorithm | null;
  issuer: string | null;
  secret: string | null;
};

export type ClientAudiences = {
  credentials: Array<string>;
  identity: Array<string>;
};

export type ClientBackchannelAuth = {
  mode: OpenIdBackchannelAuthMode;
  uri: string | null;
  password: string | null;
  username: string | null;
};

export type ClientCustomClaims = {
  uri: string | null;
  username: string | null;
  password: string | null;
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

export type ClientIdTokenEncryption = {
  algorithm: AesAlgorithm | null;
  encryptionKeyAlgorithm: AesEncryptionKeyAlgorithm | null;
};

// TODO /connect/register compability

/**
 * https://openid.net/specs/openid-connect-registration-1_0.html
 * https://openid.net/specs/openid-connect-session-1_0.html
 */

/**
  applicationType: string;
  backchannelTokenDeliveryMode: string | null;
  clientUri: string | null;
  contacts: Array<string>;
  defaultAcrValues: Array<string>;
  defaultMaxAge: number;
  grantTypes: Array<OpenIdGrantType>;
  idTokenEncryptedResponseAlg: string | null;
  idTokenEncryptedResponseEnc: string | null;
  idTokenSignedResponseAlg: string | null;
  initiateLoginUri: string | null;
  jwks: Array<string>;
  jwksUri: string | null;
  logoUri: string | null;
  name: string;
  policyUri: string | null;
  redirectUris: Array<string>;
  requestObjectEncryptionAlg: string | null;
  requestObjectEncryptionEnc: string | null;
  requestObjectSigningAlg: string | null;
  requestUris: Array<string>;
  requireAuthTime: boolean;
  responseTypes: Array<string>;
  sectorIdentifierUri: string | null;
  subjectType: string | null;
  tokenEndpointAuthMethod: string | null;
  tokenEndpointAuthSigningAlg: string | null;
  tosUri: string | null;
  userinfoEncryptedResponseAlg: string | null;
  userinfoEncryptedResponseEnc: string | null;
  userinfoSignedResponseAlg: string | null;
 */

export type ClientAttributes = EntityAttributes & {
  active: boolean;
  allowed: ClientAllowed;
  audiences: ClientAudiences;
  authenticationAssertion: ClientAuthenticationAssertion;
  authorizationAssertion: ClientAuthorizationAssertion;
  backchannelAuth: ClientBackchannelAuth;
  backchannelLogoutUri: string | null;
  customClaims: ClientCustomClaims;
  defaults: ClientDefaults;
  description: string | null;
  domain: string;
  expiry: ClientExpiry;
  frontChannelLogoutUri: string | null;
  idTokenEncryption: ClientIdTokenEncryption;
  jwks: Array<string>;
  jwksUri: string | null;
  logoUri: string | null;
  name: string;
  opaqueAccessToken: boolean;
  postLogoutUris: Array<string>;
  profile: OpenIdClientProfile;
  redirectUris: Array<string>;
  requiredScopes: Array<Scope | string>;
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
  | "backchannelLogoutUri"
  | "description"
  | "frontChannelLogoutUri"
  | "jwks"
  | "jwksUri"
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

    allowed: Joi.object<ClientAllowed>()
      .keys({
        codeChallengeMethods: Joi.array()
          .items(Joi.string().valid(...Object.values(PKCEMethod)))
          .required(),
        grantTypes: Joi.array()
          .items(Joi.string().valid(...Object.values(OpenIdGrantType)))
          .required(),
        methods: Joi.array().items(Joi.string().lowercase()).required(),
        responseTypes: Joi.array()
          .items(Joi.string().valid(...Object.values(OpenIdResponseType)))
          .required(),
        scopes: Joi.array().items(Joi.string()).required(),
        strategies: Joi.array().items(Joi.string().lowercase()).required(),
      })
      .required(),
    audiences: Joi.object<ClientAudiences>()
      .keys({
        credentials: Joi.array().items(Joi.string().guid()).required(),
        identity: Joi.array().items(Joi.string().guid()).required(),
      })
      .required(),
    authenticationAssertion: Joi.object<ClientAuthenticationAssertion>()
      .keys({
        algorithm: Joi.string()
          .valid(...Object.values(KeyPairAlgorithm))
          .allow(null)
          .required(),
        issuer: Joi.string().allow(null).required(),
        secret: Joi.string().allow(null).required(),
      })
      .required(),
    authorizationAssertion: Joi.object<ClientAuthorizationAssertion>()
      .keys({
        algorithm: Joi.string()
          .valid(...Object.values(KeyPairAlgorithm))
          .allow(null)
          .required(),
        issuer: Joi.string().allow(null).required(),
        secret: Joi.string().allow(null).required(),
      })
      .required(),
    backchannelAuth: Joi.object<ClientBackchannelAuth>().keys({
      mode: Joi.string()
        .valid(...Object.values(OpenIdBackchannelAuthMode))
        .required(),
      uri: Joi.string().uri().allow(null).required(),
      username: Joi.string().allow(null).required(),
      password: Joi.string().allow(null).required(),
    }),
    customClaims: Joi.object<ClientCustomClaims>()
      .keys({
        uri: Joi.string().uri().allow(null).required(),
        username: Joi.string().allow(null).required(),
        password: Joi.string().allow(null).required(),
      })
      .required(),
    defaults: Joi.object<ClientDefaults>()
      .keys({
        displayMode: Joi.string()
          .valid(...Object.values(OpenIdDisplayMode))
          .required(),
        levelOfAssurance: Joi.number().valid(0, 1, 2, 3, 4).required(),
        responseMode: Joi.string()
          .valid(...Object.values(OpenIdResponseMode))
          .required(),
      })
      .required(),
    expiry: Joi.object<ClientExpiry>()
      .keys({
        accessToken: JOI_EXPIRY_REGEX.required(),
        idToken: JOI_EXPIRY_REGEX.required(),
        refreshToken: JOI_EXPIRY_REGEX.required(),
      })
      .required(),
    idTokenEncryption: Joi.object<ClientIdTokenEncryption>()
      .keys({
        algorithm: Joi.string()
          .valid(...Object.values(AesAlgorithm))
          .allow(null)
          .required(),
        encryptionKeyAlgorithm: Joi.string()
          .valid(...Object.values(AesEncryptionKeyAlgorithm))
          .allow(null)
          .required(),
      })
      .required(),

    active: Joi.boolean().required(),
    backchannelLogoutUri: Joi.string().uri().required(),
    description: Joi.string().allow(null).required(),
    domain: Joi.string().uri().required(),
    frontChannelLogoutUri: Joi.string().uri().allow(null).required(),
    jwks: Joi.array().items(Joi.string()).required(),
    jwksUri: Joi.string().uri().allow(null).required(),
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
  public backchannelAuth: ClientBackchannelAuth;
  public backchannelLogoutUri: string | null;
  public customClaims: ClientCustomClaims;
  public defaults: ClientDefaults;
  public description: string | null;
  public domain: string;
  public expiry: ClientExpiry;
  public frontChannelLogoutUri: string | null;
  public idTokenEncryption: ClientIdTokenEncryption;
  public jwks: Array<string>;
  public jwksUri: string | null;
  public logoUri: string | null;
  public name: string;
  public opaqueAccessToken: boolean;
  public postLogoutUris: Array<string>;
  public profile: OpenIdClientProfile;
  public redirectUris: Array<string>;
  public requiredScopes: Array<Scope | string>;
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
    this.backchannelAuth = options.backchannelAuth;
    this.backchannelLogoutUri = options.backchannelLogoutUri || null;
    this.customClaims = options.customClaims;
    this.defaults = options.defaults;
    this.description = options.description || null;
    this.domain = options.domain;
    this.expiry = options.expiry;
    this.frontChannelLogoutUri = options.frontChannelLogoutUri || null;
    this.idTokenEncryption = options.idTokenEncryption;
    this.jwks = options.jwks || [];
    this.jwksUri = options.jwksUri || null;
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
      backchannelAuth: this.backchannelAuth,
      backchannelLogoutUri: this.backchannelLogoutUri,
      customClaims: this.customClaims,
      defaults: this.defaults,
      description: this.description,
      domain: this.domain,
      expiry: this.expiry,
      frontChannelLogoutUri: this.frontChannelLogoutUri,
      idTokenEncryption: this.idTokenEncryption,
      jwks: this.jwks,
      jwksUri: this.jwksUri,
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
