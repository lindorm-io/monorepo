import Joi from "joi";
import { ClientAllowed, ClientDefaults, ClientExpiry, Context } from "../../types";
import { ClientError } from "@lindorm-io/errors";
import { Controller, ControllerResponse } from "@lindorm-io/koa";
import { JOI_LEVEL_OF_ASSURANCE, JOI_SCOPE_DESCRIPTION, ScopeDescription } from "../../common";
import { isUndefined, startsWith } from "lodash";
import {
  JOI_DISPLAY_MODE,
  JOI_EXPIRY_REGEX,
  JOI_GRANT_TYPE,
  JOI_RESPONSE_MODE,
  JOI_RESPONSE_TYPE,
} from "../../constant";

interface RequestData {
  id: string;
  allowed: Partial<ClientAllowed>;
  defaults: Partial<ClientDefaults>;
  description: string;
  expiry: Partial<ClientExpiry>;
  host: string;
  logoutUri: string;
  name: string;
  redirectUri: string;
  scopeDescriptions: Array<ScopeDescription>;
}

export const updateClientDataSchema = Joi.object<RequestData>({
  id: Joi.string().required(),

  allowed: Joi.object({
    grantTypes: Joi.array().items(JOI_GRANT_TYPE).optional(),
    responseTypes: Joi.array().items(JOI_RESPONSE_TYPE).optional(),
    scopes: Joi.array().items(Joi.string()).optional(),
  }).optional(),
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
  logoutUri: Joi.string().uri().optional(),
  name: Joi.string().optional(),
  redirectUri: Joi.string().uri().optional(),
  scopeDescriptions: Joi.array().items(JOI_SCOPE_DESCRIPTION).optional(),
});

export const updateClientDataController: Controller<Context<RequestData>> = async (
  ctx,
): ControllerResponse => {
  const {
    cache: { clientCache },
    data: {
      allowed,
      defaults,
      description,
      expiry,
      host,
      logoutUri,
      name,
      redirectUri,
      scopeDescriptions,
    },
    entity: { client },
    repository: { clientRepository },
  } = ctx;

  if (allowed?.grantTypes) {
    client.allowed.grantTypes = allowed.grantTypes;
  }
  if (allowed?.responseTypes) {
    client.allowed.responseTypes = allowed.responseTypes;
  }
  if (allowed?.scopes) {
    client.allowed.scopes = allowed.scopes;
  }

  if (defaults?.displayMode) {
    client.defaults.displayMode = defaults.displayMode;
  }
  if (defaults?.levelOfAssurance) {
    client.defaults.levelOfAssurance = defaults.levelOfAssurance;
  }
  if (defaults?.responseMode) {
    client.defaults.responseMode = defaults.responseMode;
  }

  if (!isUndefined(description)) {
    client.description = description;
  }

  if (!isUndefined(expiry?.accessToken)) {
    client.expiry.accessToken = expiry.accessToken;
  }
  if (!isUndefined(expiry?.idToken)) {
    client.expiry.idToken = expiry.idToken;
  }
  if (!isUndefined(expiry?.refreshToken)) {
    client.expiry.refreshToken = expiry.refreshToken;
  }

  if (host) {
    client.host = host;
  }

  if (logoutUri) {
    if (!startsWith(logoutUri, client.host)) {
      throw new ClientError("Invalid logoutUri", {
        description: "URI must contain client host",
      });
    }

    client.logoutUri = logoutUri;
  }

  if (name) {
    client.name = name;
  }

  if (redirectUri) {
    if (!startsWith(redirectUri, client.host)) {
      throw new ClientError("Invalid redirectUri", {
        description: "URI must contain client host",
      });
    }

    client.redirectUri = redirectUri;
  }

  if (scopeDescriptions) {
    client.scopeDescriptions = scopeDescriptions;
  }

  const updated = await clientRepository.update(client);
  await clientCache.update(updated);

  return {
    body: {},
  };
};
