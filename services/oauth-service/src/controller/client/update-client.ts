import Joi from "joi";
import { ClientDefaults, ClientExpiry, ServerKoaController } from "../../types";
import { ControllerResponse } from "@lindorm-io/koa";
import { JOI_DISPLAY_MODE, JOI_EXPIRY_REGEX, JOI_RESPONSE_MODE } from "../../constant";
import { isUndefined } from "lodash";
import { JOI_LEVEL_OF_ASSURANCE, JOI_SCOPE_DESCRIPTION } from "../../common";
import { ScopeDescription } from "@lindorm-io/common-types";

type RequestData = {
  id: string;
  audiences: Array<string>;
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
};

export const updateClientSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
    audiences: Joi.array().items(Joi.string()),
    defaults: Joi.object().keys({
      displayMode: JOI_DISPLAY_MODE,
      levelOfAssurance: JOI_LEVEL_OF_ASSURANCE,
      responseMode: JOI_RESPONSE_MODE,
    }),
    description: Joi.string().allow(null),
    expiry: Joi.object().keys({
      accessToken: JOI_EXPIRY_REGEX.allow(null),
      idToken: JOI_EXPIRY_REGEX.allow(null),
      refreshToken: JOI_EXPIRY_REGEX.allow(null),
    }),
    host: Joi.string().uri(),
    logoUri: Joi.string().uri().allow(null),
    logoutUri: Joi.string().uri(),
    name: Joi.string(),
    redirectUris: Joi.array().items(Joi.string().uri()),
    requiredScopes: Joi.array().items(Joi.string()),
    rtbfUri: Joi.string().uri().allow(null),
    scopeDescriptions: Joi.array().items(JOI_SCOPE_DESCRIPTION),
  })
  .required();

export const updateClientController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    cache: { clientCache },
    data: {
      audiences,
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

  if (!isUndefined(audiences)) client.audiences = audiences;
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
};
