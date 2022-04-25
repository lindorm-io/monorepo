import Joi from "joi";
import { ClientDefaults, ClientExpiry, Context } from "../../types";
import { Controller, ControllerResponse } from "@lindorm-io/koa";
import { JOI_DISPLAY_MODE, JOI_EXPIRY_REGEX, JOI_RESPONSE_MODE } from "../../constant";
import { isUndefined } from "lodash";
import {
  JOI_GUID,
  JOI_LEVEL_OF_ASSURANCE,
  JOI_SCOPE_DESCRIPTION,
  ScopeDescription,
} from "../../common";

interface RequestData {
  id: string;
  defaults: ClientDefaults;
  description: string | null;
  expiry: ClientExpiry;
  host: string;
  logoUri: string | null;
  logoutUri: string;
  name: string;
  redirectUris: Array<string>;
  requiredScopes: Array<string>;
  rtbfUri: string | null;
  scopeDescriptions: Array<ScopeDescription>;
}

export const updateClientSchema = Joi.object<RequestData>({
  id: JOI_GUID.required(),
  defaults: Joi.object({
    displayMode: JOI_DISPLAY_MODE.optional(),
    levelOfAssurance: JOI_LEVEL_OF_ASSURANCE.optional(),
    responseMode: JOI_RESPONSE_MODE.optional(),
  }).optional(),
  description: Joi.string().allow(null).optional(),
  expiry: Joi.object({
    accessToken: JOI_EXPIRY_REGEX.allow(null).optional(),
    idToken: JOI_EXPIRY_REGEX.allow(null).optional(),
    refreshToken: JOI_EXPIRY_REGEX.allow(null).optional(),
  }).optional(),
  host: Joi.string().uri().optional(),
  logoUri: Joi.string().uri().allow(null).optional(),
  logoutUri: Joi.string().uri().optional(),
  name: Joi.string().optional(),
  redirectUris: Joi.array().items(Joi.string().uri()).optional(),
  requiredScopes: Joi.array().items(Joi.string()).optional(),
  rtbfUri: Joi.string().uri().allow(null).optional(),
  scopeDescriptions: Joi.array().items(JOI_SCOPE_DESCRIPTION).optional(),
});

export const updateClientController: Controller<Context<RequestData>> = async (
  ctx,
): ControllerResponse => {
  const {
    cache: { clientCache },
    data: {
      defaults,
      description,
      expiry,
      host,
      logoUri,
      logoutUri,
      name,
      redirectUris,
      requiredScopes,
      rtbfUri,
      scopeDescriptions,
    },
    entity: { client },
    repository: { clientRepository },
  } = ctx;

  if (!isUndefined(defaults?.displayMode)) client.defaults.displayMode = defaults.displayMode;
  if (!isUndefined(defaults?.levelOfAssurance))
    client.defaults.levelOfAssurance = defaults.levelOfAssurance;
  if (!isUndefined(defaults?.responseMode)) client.defaults.responseMode = defaults.responseMode;
  if (!isUndefined(description)) client.description = description;
  if (!isUndefined(expiry?.accessToken)) client.expiry.accessToken = expiry.accessToken;
  if (!isUndefined(expiry?.idToken)) client.expiry.idToken = expiry.idToken;
  if (!isUndefined(expiry?.refreshToken)) client.expiry.refreshToken = expiry.refreshToken;
  if (!isUndefined(host)) client.host = host;
  if (!isUndefined(logoUri)) client.logoUri = logoUri;
  if (!isUndefined(logoutUri)) client.logoutUri = logoutUri;
  if (!isUndefined(name)) client.name = name;
  if (!isUndefined(redirectUris)) client.redirectUris = redirectUris;
  if (!isUndefined(requiredScopes)) client.requiredScopes = requiredScopes;
  if (!isUndefined(rtbfUri)) client.rtbfUri = rtbfUri;
  if (!isUndefined(scopeDescriptions)) client.scopeDescriptions = scopeDescriptions;

  const updated = await clientRepository.update(client);
  await clientCache.update(updated);

  return { body: {} };
};
