import Joi from "joi";
import { ClientAllowed, ClientDefaults, ClientExpiry } from "../types";
import {
  OauthClientType,
  OauthDisplayModes,
  OauthResponseModes,
  ScopeDescription,
} from "@lindorm-io/common-types";
import {
  EntityAttributes,
  EntityOptions,
  JOI_ENTITY_BASE,
  LindormEntity,
} from "@lindorm-io/entity";
import {
  JOI_DISPLAY_MODE,
  JOI_EXPIRY_REGEX,
  JOI_GRANT_TYPE,
  JOI_RESPONSE_MODE,
  JOI_RESPONSE_TYPE,
} from "../constant";
import {
  JOI_ARGON_STRING,
  JOI_CLIENT_TYPE,
  JOI_LEVEL_OF_ASSURANCE,
  JOI_SCOPE_DESCRIPTION,
} from "../common";

export type ClientAttributes = EntityAttributes & {
  active: boolean;
  allowed: ClientAllowed;
  audiences: Array<string>;
  backChannelLogoutUri: string | null;
  defaults: ClientDefaults;
  description: string | null;
  enforceBasicAuth: boolean;
  enforceSecret: boolean;
  expiry: ClientExpiry;
  frontChannelLogoutUri: string | null;
  host: string;
  logoUri: string | null;
  name: string;
  postLogoutUris: Array<string>;
  redirectUris: Array<string>;
  requiredScopes: Array<string>;
  rtbfUri: string | null;
  scopeDescriptions: Array<ScopeDescription>;
  secret: string;
  tenantId: string;
  type: OauthClientType;
};

export type ClientOptions = EntityOptions & {
  active?: boolean;
  allowed?: Partial<ClientAllowed>;
  audiences?: Array<string>;
  backChannelLogoutUri?: string | null;
  defaults?: Partial<ClientDefaults>;
  description?: string | null;
  enforceBasicAuth?: boolean;
  enforceSecret?: boolean;
  expiry?: Partial<ClientExpiry>;
  frontChannelLogoutUri?: string | null;
  host: string;
  logoUri?: string | null;
  name: string;
  postLogoutUris?: Array<string>;
  redirectUris?: Array<string>;
  requiredScopes?: Array<string>;
  rtbfUri?: string | null;
  scopeDescriptions?: Array<ScopeDescription>;
  secret: string;
  tenantId: string;
  type: OauthClientType;
};

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
        accessToken: JOI_EXPIRY_REGEX.allow(null).required(),
        idToken: JOI_EXPIRY_REGEX.allow(null).required(),
        refreshToken: JOI_EXPIRY_REGEX.allow(null).required(),
      })
      .required(),

    active: Joi.boolean().required(),
    audiences: Joi.array().items(Joi.string()).required(),
    backChannelLogoutUri: Joi.string().uri().required(),
    description: Joi.string().allow(null).required(),
    enforceBasicAuth: Joi.boolean().required(),
    enforceSecret: Joi.boolean().required(),
    frontChannelLogoutUri: Joi.string().uri().allow(null).required(),
    host: Joi.string().uri().required(),
    logoUri: Joi.string().uri().allow(null).required(),
    name: Joi.string().required(),
    postLogoutUris: Joi.array().items(Joi.string().uri()).required(),
    redirectUris: Joi.array().items(Joi.string().uri()).required(),
    requiredScopes: Joi.array().items(Joi.string()).required(),
    rtbfUri: Joi.string().uri().allow(null).required(),
    scopeDescriptions: Joi.array().items(JOI_SCOPE_DESCRIPTION).required(),
    secret: JOI_ARGON_STRING.required(),
    tenantId: Joi.string().guid().required(),
    type: JOI_CLIENT_TYPE.required(),
  })
  .required();

export class Client extends LindormEntity<ClientAttributes> {
  public active: boolean;
  public allowed: ClientAllowed;
  public audiences: Array<string>;
  public backChannelLogoutUri: string | null;
  public defaults: ClientDefaults;
  public description: string | null;
  public enforceBasicAuth: boolean;
  public enforceSecret: boolean;
  public expiry: ClientExpiry;
  public frontChannelLogoutUri: string | null;
  public host: string;
  public logoUri: string | null;
  public name: string;
  public postLogoutUris: Array<string>;
  public redirectUris: Array<string>;
  public requiredScopes: Array<string>;
  public rtbfUri: string | null;
  public scopeDescriptions: Array<ScopeDescription>;
  public secret: string;
  public tenantId: string;
  public type: OauthClientType;

  public constructor(options: ClientOptions) {
    super(options);

    this.allowed = {
      grantTypes: options.allowed?.grantTypes || [],
      responseTypes: options.allowed?.responseTypes || [],
      scopes: options.allowed?.scopes || [],
    };
    this.defaults = {
      audiences: options.defaults?.audiences || [],
      displayMode: options.defaults?.displayMode || OauthDisplayModes.PAGE,
      levelOfAssurance: options.defaults?.levelOfAssurance || 1,
      responseMode: options.defaults?.responseMode || OauthResponseModes.QUERY,
    };
    this.expiry = {
      accessToken: options.expiry?.accessToken || null,
      idToken: options.expiry?.idToken || null,
      refreshToken: options.expiry?.refreshToken || null,
    };

    this.active = options.active === true;
    this.audiences = options.audiences || [];
    this.backChannelLogoutUri = options.backChannelLogoutUri || null;
    this.description = options.description || null;
    this.enforceBasicAuth = options.enforceBasicAuth === true;
    this.enforceSecret = options.enforceSecret === true;
    this.frontChannelLogoutUri = options.frontChannelLogoutUri || null;
    this.host = options.host;
    this.logoUri = options.logoUri || null;
    this.name = options.name;
    this.postLogoutUris = options.postLogoutUris || [];
    this.redirectUris = options.redirectUris || [];
    this.requiredScopes = options.requiredScopes || [];
    this.rtbfUri = options.rtbfUri || null;
    this.scopeDescriptions = options.scopeDescriptions || [];
    this.secret = options.secret;
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
      defaults: this.defaults,
      description: this.description,
      enforceBasicAuth: this.enforceBasicAuth,
      enforceSecret: this.enforceSecret,
      expiry: this.expiry,
      frontChannelLogoutUri: this.frontChannelLogoutUri,
      host: this.host,
      logoUri: this.logoUri,
      name: this.name,
      postLogoutUris: this.postLogoutUris,
      redirectUris: this.redirectUris,
      requiredScopes: this.requiredScopes,
      rtbfUri: this.rtbfUri,
      scopeDescriptions: this.scopeDescriptions,
      secret: this.secret,
      tenantId: this.tenantId,
      type: this.type,
    };
  }
}
