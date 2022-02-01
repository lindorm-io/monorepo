import Joi from "joi";
import { ClientAllowed, ClientDefaults, ClientExpiry } from "../types";
import {
  EntityAttributes,
  EntityKeys,
  JOI_ENTITY_BASE,
  LindormEntity,
  Optional,
} from "@lindorm-io/entity";
import {
  JOI_DISPLAY_MODE,
  JOI_EXPIRY_REGEX,
  JOI_GRANT_TYPE,
  JOI_RESPONSE_MODE,
  JOI_RESPONSE_TYPE,
} from "../constant";
import {
  ClientType,
  DisplayMode,
  JOI_ARGON_STRING,
  JOI_CLIENT_TYPE,
  JOI_GUID,
  JOI_LEVEL_OF_ASSURANCE,
  JOI_SCOPE_DESCRIPTION,
  ResponseMode,
  ScopeDescription,
} from "../common";

export interface ClientAttributes extends EntityAttributes {
  active: boolean;
  allowed: ClientAllowed;
  defaults: ClientDefaults;
  description: string | null;
  expiry: ClientExpiry;
  host: string;
  logoUri: string | null;
  logoutUri: string;
  name: string;
  owners: Array<string>;
  permissions: Array<string>;
  redirectUri: string;
  requiredScopes: Array<string>;
  rtbfUri: string | null;
  scopeDescriptions: Array<ScopeDescription>;
  secret: string;
  type: ClientType;
}

export type ClientOptions = Optional<
  ClientAttributes,
  | EntityKeys
  | "allowed"
  | "defaults"
  | "description"
  | "expiry"
  | "logoUri"
  | "permissions"
  | "requiredScopes"
  | "rtbfUri"
  | "scopeDescriptions"
>;

const schema = Joi.object<ClientAttributes>({
  ...JOI_ENTITY_BASE,

  active: Joi.boolean().required(),
  allowed: Joi.object({
    grantTypes: Joi.array().items(JOI_GRANT_TYPE).required(),
    responseTypes: Joi.array().items(JOI_RESPONSE_TYPE).required(),
    scopes: Joi.array().items(Joi.string()).required(),
  }).required(),
  defaults: Joi.object({
    displayMode: JOI_DISPLAY_MODE.required(),
    levelOfAssurance: JOI_LEVEL_OF_ASSURANCE.required(),
    responseMode: JOI_RESPONSE_MODE.required(),
  }).required(),
  description: Joi.string().allow(null).required(),
  expiry: Joi.object({
    accessToken: JOI_EXPIRY_REGEX.allow(null).required(),
    idToken: JOI_EXPIRY_REGEX.allow(null).required(),
    refreshToken: JOI_EXPIRY_REGEX.allow(null).required(),
  }).required(),
  host: Joi.string().uri().required(),
  logoUri: Joi.string().uri().allow(null).required(),
  logoutUri: Joi.string().uri().required(),
  name: Joi.string().required(),
  owners: Joi.array().items(JOI_GUID).required(),
  permissions: Joi.array().items(Joi.string()).required(),
  redirectUri: Joi.string().uri().required(),
  requiredScopes: Joi.array().items(Joi.string()).required(),
  rtbfUri: Joi.string().uri().allow(null).required(),
  scopeDescriptions: Joi.array().items(JOI_SCOPE_DESCRIPTION).required(),
  secret: JOI_ARGON_STRING.required(),
  type: JOI_CLIENT_TYPE.required(),
});

export class Client extends LindormEntity<ClientAttributes> {
  public active: boolean;
  public allowed: ClientAllowed;
  public defaults: ClientDefaults;
  public description: string | null;
  public expiry: ClientExpiry;
  public host: string;
  public logoUri: string | null;
  public logoutUri: string;
  public name: string;
  public owners: Array<string>;
  public permissions: Array<string>;
  public redirectUri: string;
  public requiredScopes: Array<string>;
  public rtbfUri: string | null;
  public scopeDescriptions: Array<ScopeDescription>;
  public secret: string | null;
  public type: ClientType;

  public constructor(options: ClientOptions) {
    super(options);

    this.active = options.active === true;
    this.allowed = {
      grantTypes: options.allowed?.grantTypes || [],
      responseTypes: options.allowed?.responseTypes || [],
      scopes: options.allowed?.scopes || [],
    };
    this.defaults = {
      displayMode: options.defaults?.displayMode || DisplayMode.PAGE,
      levelOfAssurance: options.defaults?.levelOfAssurance || 1,
      responseMode: options.defaults?.responseMode || ResponseMode.QUERY,
    };
    this.description = options.description || null;
    this.expiry = {
      accessToken: options.expiry?.accessToken || null,
      idToken: options.expiry?.idToken || null,
      refreshToken: options.expiry?.refreshToken || null,
    };
    this.host = options.host;
    this.logoUri = options.logoUri || null;
    this.logoutUri = options.logoutUri;
    this.name = options.name;
    this.owners = options.owners;
    this.permissions = options.permissions || [];
    this.redirectUri = options.redirectUri;
    this.requiredScopes = options.requiredScopes || [];
    this.rtbfUri = options.rtbfUri || null;
    this.scopeDescriptions = options.scopeDescriptions || [];
    this.secret = options.secret;
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
      defaults: this.defaults,
      description: this.description,
      expiry: this.expiry,
      host: this.host,
      logoUri: this.logoUri,
      logoutUri: this.logoutUri,
      name: this.name,
      owners: this.owners,
      permissions: this.permissions,
      redirectUri: this.redirectUri,
      requiredScopes: this.requiredScopes,
      rtbfUri: this.rtbfUri,
      scopeDescriptions: this.scopeDescriptions,
      secret: this.secret,
      type: this.type,
    };
  }
}
