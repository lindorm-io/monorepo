import Joi from "joi";
import { ClientAllowed, ClientDefaults, ClientExpiry, ServerKoaController } from "../../types";
import { ControllerResponse } from "@lindorm-io/koa";
import { JOI_CLIENT_TYPE, JOI_LEVEL_OF_ASSURANCE, JOI_SCOPE_DESCRIPTION } from "../../common";
import {
  LindormScope,
  OpenIdClientType,
  OpenIdScope,
  ScopeDescription,
} from "@lindorm-io/common-types";
import { isUndefined } from "lodash";
import {
  JOI_DISPLAY_MODE,
  JOI_EXPIRY_REGEX,
  JOI_GRANT_TYPE,
  JOI_RESPONSE_MODE,
  JOI_RESPONSE_TYPE,
} from "../../constant";

type RequestData = {
  id: string;
  active: boolean;
  allowed: ClientAllowed;
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
    defaults: Joi.object().keys({
      audiences: Joi.array().items(Joi.string().guid()),
      displayMode: JOI_DISPLAY_MODE,
      levelOfAssurance: JOI_LEVEL_OF_ASSURANCE,
      responseMode: JOI_RESPONSE_MODE,
    }),
    expiry: Joi.object().keys({
      accessToken: JOI_EXPIRY_REGEX.allow(null),
      idToken: JOI_EXPIRY_REGEX.allow(null),
      refreshToken: JOI_EXPIRY_REGEX.allow(null),
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
      postLogoutUris,
      redirectUris,
      requiredScopes,
      rtbfUri,
      scopeDescriptions,
      type,
    },
    entity: { client },
    repository: { clientRepository },
  } = ctx;

  if (!isUndefined(allowed?.grantTypes)) client.allowed.grantTypes = allowed.grantTypes;
  if (!isUndefined(allowed?.responseTypes)) client.allowed.responseTypes = allowed.responseTypes;
  if (!isUndefined(allowed?.scopes)) client.allowed.scopes = allowed.scopes;

  if (!isUndefined(defaults?.audiences)) client.defaults.audiences = defaults.audiences;
  if (!isUndefined(defaults?.displayMode)) client.defaults.displayMode = defaults.displayMode;
  if (!isUndefined(defaults?.levelOfAssurance))
    client.defaults.levelOfAssurance = defaults.levelOfAssurance;
  if (!isUndefined(defaults?.responseMode)) client.defaults.responseMode = defaults.responseMode;

  if (!isUndefined(expiry?.accessToken)) client.expiry.accessToken = expiry.accessToken;
  if (!isUndefined(expiry?.idToken)) client.expiry.idToken = expiry.idToken;
  if (!isUndefined(expiry?.refreshToken)) client.expiry.refreshToken = expiry.refreshToken;

  if (!isUndefined(active)) client.active = active;
  if (!isUndefined(backChannelLogoutUri)) client.backChannelLogoutUri = backChannelLogoutUri;
  if (!isUndefined(description)) client.description = description;
  if (!isUndefined(enforceBasicAuth)) client.enforceBasicAuth = enforceBasicAuth;
  if (!isUndefined(enforceSecret)) client.enforceSecret = enforceSecret;
  if (!isUndefined(frontChannelLogoutUri)) client.frontChannelLogoutUri = frontChannelLogoutUri;
  if (!isUndefined(host)) client.host = host;
  if (!isUndefined(logoUri)) client.logoUri = logoUri;
  if (!isUndefined(name)) client.name = name;
  if (!isUndefined(postLogoutUris)) client.postLogoutUris = postLogoutUris;
  if (!isUndefined(redirectUris)) client.redirectUris = redirectUris;
  if (!isUndefined(requiredScopes)) client.requiredScopes = requiredScopes;
  if (!isUndefined(rtbfUri)) client.rtbfUri = rtbfUri;
  if (!isUndefined(scopeDescriptions)) client.scopeDescriptions = scopeDescriptions;
  if (!isUndefined(type)) client.type = type;

  await clientRepository.update(client);
};
