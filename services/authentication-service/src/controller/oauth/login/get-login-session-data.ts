import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../../types";
import { fetchOauthLoginData } from "../../../handler";
import { SessionStatus } from "@lindorm-io/common-types";

type RequestData = {
  id: string;
};

type ResponseBody = {
  client: {
    name: string;
    description: string | null;
    logoUri: string | null;
  };
  status: SessionStatus;
};

export const getLoginSessionDataSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
  })
  .required();

export const getLoginSessionDataController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    data: { id },
  } = ctx;

  const {
    loginStatus,
    client: { name, description, logoUri },
  } = await fetchOauthLoginData(ctx, id);

  return {
    body: {
      client: { name, description, logoUri },
      status: loginStatus,
    },
  };
};
