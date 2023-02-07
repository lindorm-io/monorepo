import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../../types";
import { fetchOauthElevationData } from "../../../handler";
import { SessionStatus } from "@lindorm-io/common-types";

type RequestData = {
  id: string;
};

type ResponseBody = {
  status: SessionStatus;
};

export const getElevationSessionDataSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
  })
  .required();

export const getElevationSessionDataController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    data: { id },
  } = ctx;

  const { elevationStatus } = await fetchOauthElevationData(ctx, id);

  return { body: { status: elevationStatus } };
};
