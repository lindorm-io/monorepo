import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../../types";
import { fetchOauthConsentData } from "../../../handler";
import { OauthClientType, ScopeDescription, SessionStatus } from "@lindorm-io/common-types";

type RequestData = {
  id: string;
};

type ResponseBody = {
  client: {
    name: string;
    description: string | null;
    logoUri: string | null;
    requiredScopes: Array<string>;
    scopeDescriptions: Array<ScopeDescription>;
    type: OauthClientType;
  };
  requested: {
    audiences: Array<string>;
    scopes: Array<string>;
  };
  status: SessionStatus;
};

export const getConsentSessionDataSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
  })
  .required();

export const getConsentSessionDataController: ServerKoaController = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    data: { id },
  } = ctx;

  const {
    consentStatus,
    client: { name, description, logoUri, requiredScopes, scopeDescriptions, type },
    requested: { audiences, scopes },
  } = await fetchOauthConsentData(ctx, id);

  return {
    body: {
      client: {
        description,
        logoUri,
        name,
        requiredScopes,
        scopeDescriptions,
        type,
      },
      requested: {
        audiences,
        scopes,
      },
      status: consentStatus,
    },
  };
};
