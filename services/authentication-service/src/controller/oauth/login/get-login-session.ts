import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../../types";
import { getOauthAuthorizationSession } from "../../../handler";
import { PublicClientInfo, SessionStatus } from "@lindorm-io/common-types";

type RequestData = {
  id: string;
};

type ResponseBody = {
  client: PublicClientInfo;
  status: SessionStatus;
};

export const getLoginSessionSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
  })
  .required();

export const getLoginSessionController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    data: { id },
  } = ctx;

  const {
    login: { status },
    client,
  } = await getOauthAuthorizationSession(ctx, id);

  return {
    body: {
      status,
      client,
    },
  };
};
