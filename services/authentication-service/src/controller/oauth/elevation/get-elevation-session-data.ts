import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { JOI_GUID, SessionStatus } from "../../../common";
import { ServerKoaController } from "../../../types";
import { fetchOauthElevationData } from "../../../handler";

type RequestData = {
  id: string;
};

type ResponseBody = {
  status: SessionStatus;
};

export const getElevationSessionDataSchema = Joi.object<RequestData>()
  .keys({
    id: JOI_GUID.required(),
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
