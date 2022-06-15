import { ClientType, ScopeDescription } from "../../common";
import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../types";

interface ResponseBody {
  client: {
    name: string;
    description: string | null;
    logoUri: string | null;
    requiredScopes: Array<string>;
    scopeDescriptions: Array<ScopeDescription>;
    type: ClientType;
  };
  requested: {
    audiences: Array<string>;
    scopes: Array<string>;
  };
}

export const getConsentInfoController: ServerKoaController = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    entity: { consentSession },
  } = ctx;

  return {
    body: {
      client: {
        description: consentSession.description,
        logoUri: consentSession.logoUri,
        name: consentSession.name,
        requiredScopes: consentSession.requiredScopes,
        scopeDescriptions: consentSession.scopeDescriptions,
        type: consentSession.type,
      },
      requested: {
        audiences: consentSession.requestedAudiences,
        scopes: consentSession.requestedScopes,
      },
    },
  };
};
