import {
  LindormScope,
  OpenIdClientType,
  OpenIdScope,
  ScopeDescription,
} from "@lindorm-io/common-types";
import { ControllerResponse } from "@lindorm-io/koa";
import Joi from "joi";
import { JOI_CLIENT_TYPE, JOI_LEVEL_OF_ASSURANCE, JOI_SCOPE_DESCRIPTION } from "../../common";
import {
  JOI_DISPLAY_MODE,
  JOI_EXPIRY_REGEX,
  JOI_GRANT_TYPE,
  JOI_RESPONSE_MODE,
  JOI_RESPONSE_TYPE,
} from "../../constant";
import { ClientAllowed, ClientAudiences, ClientDefaults, ClientExpiry } from "../../entity";
import { ServerKoaController } from "../../types";

type RequestData = {
  id: string;
  active: boolean;
  allowed: ClientAllowed;
  audiences: ClientAudiences;
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
  opaqueAccessToken: boolean;
  opaqueRefreshToken: boolean;
  postLogoutUris: Array<string>;
  redirectUris: Array<string>;
  requiredScopes: Array<OpenIdScope | LindormScope>;
  rtbfUri: string | null;
  scopeDescriptions: Array<ScopeDescription>;
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
    enforceBasicAuth: Joi.boolean(),
    enforceSecret: Joi.boolean(),
    frontChannelLogoutUri: Joi.string().uri().allow(null),
    host: Joi.string().uri(),
    logoUri: Joi.string().uri().allow(null),
    name: Joi.string(),
    opaqueAccessToken: Joi.boolean(),
    opaqueRefreshToken: Joi.boolean(),
    postLogoutUris: Joi.array().items(Joi.string().uri()),
    redirectUris: Joi.array().items(Joi.string().uri()),
    requiredScopes: Joi.array().items(Joi.string()),
    rtbfUri: Joi.string().uri().allow(null),
    scopeDescriptions: Joi.array().items(JOI_SCOPE_DESCRIPTION),
    type: JOI_CLIENT_TYPE,
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
      defaults,
      description,
      enforceBasicAuth,
      enforceSecret,
      expiry,
      frontChannelLogoutUri,
      host,
      logoUri,
      name,
      opaqueAccessToken,
      opaqueRefreshToken,
      postLogoutUris,
      redirectUris,
      requiredScopes,
      rtbfUri,
      scopeDescriptions,
      type,
    },
    entity: { client },
    mongo: { clientRepository },
  } = ctx;

  if (allowed?.grantTypes !== undefined) client.allowed.grantTypes = allowed.grantTypes;
  if (allowed?.responseTypes !== undefined) client.allowed.responseTypes = allowed.responseTypes;
  if (allowed?.scopes !== undefined) client.allowed.scopes = allowed.scopes;

  if (audiences?.credentials !== undefined) client.audiences.credentials = audiences.credentials;
  if (audiences?.identity !== undefined) client.audiences.identity = audiences.identity;

  if (defaults?.displayMode !== undefined) client.defaults.displayMode = defaults.displayMode;
  if (defaults?.levelOfAssurance) client.defaults.levelOfAssurance = defaults.levelOfAssurance;
  if (defaults?.responseMode !== undefined) client.defaults.responseMode = defaults.responseMode;

  if (expiry?.accessToken !== undefined) client.expiry.accessToken = expiry.accessToken;
  if (expiry?.idToken !== undefined) client.expiry.idToken = expiry.idToken;
  if (expiry?.refreshToken !== undefined) client.expiry.refreshToken = expiry.refreshToken;

  if (active !== undefined) client.active = active;
  if (backChannelLogoutUri !== undefined) client.backChannelLogoutUri = backChannelLogoutUri;
  if (description !== undefined) client.description = description;
  if (enforceBasicAuth !== undefined) client.enforceBasicAuth = enforceBasicAuth;
  if (enforceSecret !== undefined) client.enforceSecret = enforceSecret;
  if (frontChannelLogoutUri !== undefined) client.frontChannelLogoutUri = frontChannelLogoutUri;
  if (host !== undefined) client.host = host;
  if (logoUri !== undefined) client.logoUri = logoUri;
  if (name !== undefined) client.name = name;
  if (opaqueAccessToken !== undefined) client.opaqueAccessToken = opaqueAccessToken;
  if (opaqueRefreshToken !== undefined) client.opaqueRefreshToken = opaqueRefreshToken;
  if (postLogoutUris !== undefined) client.postLogoutUris = postLogoutUris;
  if (redirectUris !== undefined) client.redirectUris = redirectUris;
  if (requiredScopes !== undefined) client.requiredScopes = requiredScopes;
  if (rtbfUri !== undefined) client.rtbfUri = rtbfUri;
  if (scopeDescriptions !== undefined) client.scopeDescriptions = scopeDescriptions;
  if (type !== undefined) client.type = type;

  await clientRepository.update(client);
};
