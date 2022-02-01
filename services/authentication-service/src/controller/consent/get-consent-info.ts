import { ClientType, ScopeDescription } from "../../common";
import { Context } from "../../types";
import { Controller, ControllerResponse } from "@lindorm-io/koa";

interface ResponseBody {
  client: {
    name: string;
    description: string | null;
    logoUri: string | null;
    requiredScopes: Array<string>;
    scopeDescriptions: Array<ScopeDescription>;
    type: ClientType;
  };
  scopes: Array<string>;
}

export const getConsentInfoController: Controller<Context> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    entity: { consentSession },
  } = ctx;

  const { description, logoUri, name, requestedScopes, requiredScopes, scopeDescriptions, type } =
    consentSession;

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
      scopes: requestedScopes,
    },
  };
};
