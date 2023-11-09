import { OpenIdClientProfile, OpenIdClientType, Scope } from "@lindorm-io/common-enums";
import { ScopeDescription } from "@lindorm-io/common-types";
import { ControllerResponse } from "@lindorm-io/koa";
import Joi from "joi";
import { JOI_LEVEL_OF_ASSURANCE, JOI_SCOPE_DESCRIPTION } from "../../common";
import {
  JOI_DISPLAY_MODE,
  JOI_EXPIRY_REGEX,
  JOI_GRANT_TYPE,
  JOI_RESPONSE_MODE,
  JOI_RESPONSE_TYPE,
} from "../../constant";
import {
  ClientAllowed,
  ClientAudiences,
  ClientCustomClaims,
  ClientDefaults,
  ClientExpiry,
} from "../../entity";
import { ServerKoaController } from "../../types";

type RequestData = {
  id: string;
  active: boolean;
  allowed: ClientAllowed;
  audiences: ClientAudiences;
  backChannelLogoutUri: string | null;
  customClaims: ClientCustomClaims;
  defaults: ClientDefaults;
  description: string | null;
  expiry: ClientExpiry;
  frontChannelLogoutUri: string | null;
  domain: string;
  logoUri: string | null;
  name: string;
  postLogoutUris: Array<string>;
  profile: OpenIdClientProfile;
  redirectUris: Array<string>;
  requiredScopes: Array<Scope | string>;
  rtbfUri: string | null;
  scopeDescriptions: Array<ScopeDescription>;
  trusted: boolean;
  type: OpenIdClientType;
};

export const updateClientSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid(),

    allowed: Joi.object().keys({
      grantTypes: Joi.array().items(JOI_GRANT_TYPE),
      responseTypes: Joi.array().items(JOI_RESPONSE_TYPE),
      scopes: Joi.array().items(Joi.string()),
    }),
    audiences: Joi.object().keys({
      client: Joi.array().items(Joi.string().guid()),
      identity: Joi.array().items(Joi.string().guid()),
    }),
    customClaims: Joi.object().keys({
      uri: Joi.string().uri().allow(null),
      username: Joi.string().allow(null),
      password: Joi.string().allow(null),
    }),
    defaults: Joi.object().keys({
      displayMode: JOI_DISPLAY_MODE,
      levelOfAssurance: JOI_LEVEL_OF_ASSURANCE,
      responseMode: JOI_RESPONSE_MODE,
    }),
    expiry: Joi.object().keys({
      accessToken: JOI_EXPIRY_REGEX,
      idToken: JOI_EXPIRY_REGEX,
      refreshToken: JOI_EXPIRY_REGEX,
    }),

    active: Joi.boolean(),
    backChannelLogoutUri: Joi.string().uri(),
    description: Joi.string().allow(null),
    frontChannelLogoutUri: Joi.string().uri().allow(null),
    domain: Joi.string().uri(),
    logoUri: Joi.string().uri().allow(null),
    name: Joi.string(),
    postLogoutUris: Joi.array().items(Joi.string().uri()),
    profile: Joi.string().valid(...Object.values(OpenIdClientProfile)),
    redirectUris: Joi.array().items(Joi.string().uri()),
    requiredScopes: Joi.array().items(Joi.string()),
    rtbfUri: Joi.string().uri().allow(null),
    scopeDescriptions: Joi.array().items(JOI_SCOPE_DESCRIPTION),
    trusted: Joi.boolean(),
    type: Joi.string().valid(...Object.values(OpenIdClientType)),
  })
  .required();

export const updateClientController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    data: {
      active,
      allowed,
      audiences,
      backChannelLogoutUri,
      customClaims,
      defaults,
      description,
      expiry,
      frontChannelLogoutUri,
      domain,
      logoUri,
      name,
      postLogoutUris,
      profile,
      redirectUris,
      requiredScopes,
      rtbfUri,
      scopeDescriptions,
      trusted,
      type,
    },
    entity: { client },
    mongo: { clientRepository },
  } = ctx;

  if (allowed?.codeChallengeMethods !== undefined)
    client.allowed.codeChallengeMethods = allowed.codeChallengeMethods;
  if (allowed?.grantTypes !== undefined) client.allowed.grantTypes = allowed.grantTypes;
  if (allowed?.methods !== undefined) client.allowed.methods = allowed.methods;
  if (allowed?.responseTypes !== undefined) client.allowed.responseTypes = allowed.responseTypes;
  if (allowed?.scopes !== undefined) client.allowed.scopes = allowed.scopes;
  if (allowed?.strategies !== undefined) client.allowed.strategies = allowed.strategies;

  if (audiences?.credentials !== undefined) client.audiences.credentials = audiences.credentials;
  if (audiences?.identity !== undefined) client.audiences.identity = audiences.identity;

  if (customClaims?.uri !== undefined) client.customClaims.uri = customClaims.uri;
  if (customClaims?.username !== undefined) client.customClaims.username = customClaims.username;
  if (customClaims?.password !== undefined) client.customClaims.password = customClaims.password;

  if (defaults?.displayMode !== undefined) client.defaults.displayMode = defaults.displayMode;
  if (defaults?.levelOfAssurance) client.defaults.levelOfAssurance = defaults.levelOfAssurance;
  if (defaults?.responseMode !== undefined) client.defaults.responseMode = defaults.responseMode;

  if (expiry?.accessToken !== undefined) client.expiry.accessToken = expiry.accessToken;
  if (expiry?.idToken !== undefined) client.expiry.idToken = expiry.idToken;
  if (expiry?.refreshToken !== undefined) client.expiry.refreshToken = expiry.refreshToken;

  if (active !== undefined) client.active = active;
  if (backChannelLogoutUri !== undefined) client.backChannelLogoutUri = backChannelLogoutUri;
  if (description !== undefined) client.description = description;
  if (frontChannelLogoutUri !== undefined) client.frontChannelLogoutUri = frontChannelLogoutUri;
  if (domain !== undefined) client.domain = domain;
  if (logoUri !== undefined) client.logoUri = logoUri;
  if (name !== undefined) client.name = name;
  if (postLogoutUris !== undefined) client.postLogoutUris = postLogoutUris;
  if (profile !== undefined) client.profile = profile;
  if (redirectUris !== undefined) client.redirectUris = redirectUris;
  if (requiredScopes !== undefined) client.requiredScopes = requiredScopes;
  if (rtbfUri !== undefined) client.rtbfUri = rtbfUri;
  if (scopeDescriptions !== undefined) client.scopeDescriptions = scopeDescriptions;
  if (trusted !== undefined) client.trusted = trusted;
  if (type !== undefined) client.type = type;

  await clientRepository.update(client);
};
