import { PublicClientInfo, PublicTenantInfo, SelectAccountSession } from "@lindorm-io/common-types";
import { ControllerResponse } from "@lindorm-io/koa";
import Joi from "joi";
import { getOauthAuthorizationRequest } from "../../../handler";
import { ServerKoaController } from "../../../types";

type RequestData = {
  id: string;
};

type ResponseBody = {
  sessions: Array<SelectAccountSession>;

  client: PublicClientInfo;
  tenant: PublicTenantInfo;
};

export const getSelectAccountSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
  })
  .required();

export const getSelectAccountController: ServerKoaController = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    data: { id },
  } = ctx;

  const {
    selectAccount: { sessions },
    client,
    tenant,
  } = await getOauthAuthorizationRequest(ctx, id);

  return {
    body: {
      sessions,
      client,
      tenant,
    },
  };
};
