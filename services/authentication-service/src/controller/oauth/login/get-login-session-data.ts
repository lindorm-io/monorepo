import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { JOI_GUID, SessionStatus } from "../../../common";
import { ServerKoaController } from "../../../types";
import { fetchOauthLoginData } from "../../../handler";

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
    id: JOI_GUID.required(),
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
