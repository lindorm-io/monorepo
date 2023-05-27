import {
  PublicClientInfo,
  PublicTenantInfo,
  ScopeDescription,
  SessionStatus,
} from "@lindorm-io/common-types";
import { ControllerResponse } from "@lindorm-io/koa";
import Joi from "joi";
import { getOauthAuthorizationSession } from "../../../handler";
import { Scope, ServerKoaController } from "../../../types";

type RequestData = {
  id: string;
};

type ResponseBody = {
  audiences: Array<string>;
  optionalScopes: Array<Scope>;
  requiredScopes: Array<Scope>;
  scopeDescriptions: Array<ScopeDescription>;
  status: SessionStatus;

  client: PublicClientInfo;
  tenant: PublicTenantInfo;
};

export const getConsentSessionSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
  })
  .required();

export const getConsentSessionController: ServerKoaController = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    data: { id },
  } = ctx;

  const {
    consent: { status, audiences, optionalScopes, requiredScopes, scopeDescriptions },
    client,
    tenant,
  } = await getOauthAuthorizationSession(ctx, id);

  return {
    body: {
      status,
      audiences,
      optionalScopes,
      requiredScopes,
      scopeDescriptions,
      client,
      tenant,
    },
  };
};
