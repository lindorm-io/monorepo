import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../../types";
import { getOauthElevationSession } from "../../../handler";
import { PublicClientInfo, SessionStatus } from "@lindorm-io/common-types";

type RequestData = {
  id: string;
};

type ResponseBody = {
  client: PublicClientInfo;
  status: SessionStatus;
};

export const getElevationSessionSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
  })
  .required();

export const getElevationSessionController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    data: { id },
  } = ctx;

  const {
    client,
    elevation: { status },
  } = await getOauthElevationSession(ctx, id);

  return { body: { client, status } };
};
