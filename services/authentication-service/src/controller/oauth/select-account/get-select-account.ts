import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { PublicClientInfo, PublicTenantInfo, SelectAccountSession } from "@lindorm-io/common-types";
import { ServerKoaController } from "../../../types";
import { getOauthAuthorizationSession } from "../../../handler";

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
  } = await getOauthAuthorizationSession(ctx, id);

  return {
    body: {
      sessions,
      client,
      tenant,
    },
  };
};
