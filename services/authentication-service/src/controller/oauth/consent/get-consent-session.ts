import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../../types";
import { getOauthAuthorizationSession } from "../../../handler";
import {
  LindormScope,
  OpenIdScope,
  PublicClientInfo,
  ScopeDescription,
  SessionStatus,
} from "@lindorm-io/common-types";

type RequestData = {
  id: string;
};

type ResponseBody = {
  status: SessionStatus;
  audiences: Array<string>;
  optionalScopes: Array<OpenIdScope | LindormScope>;
  requiredScopes: Array<OpenIdScope | LindormScope>;
  scopeDescriptions: Array<ScopeDescription>;
  client: PublicClientInfo;
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
  } = await getOauthAuthorizationSession(ctx, id);

  return {
    body: {
      status,
      audiences,
      optionalScopes,
      requiredScopes,
      scopeDescriptions,
      client,
    },
  };
};
