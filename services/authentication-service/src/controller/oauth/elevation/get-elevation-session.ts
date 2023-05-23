import { PublicClientInfo, PublicTenantInfo, SessionStatus } from "@lindorm-io/common-types";
import { ControllerResponse } from "@lindorm-io/koa";
import Joi from "joi";
import { getOauthElevationRequest } from "../../../handler";
import { ServerKoaController } from "../../../types";

type RequestData = {
  id: string;
};

type ResponseBody = {
  status: SessionStatus;

  client: PublicClientInfo;
  tenant: PublicTenantInfo;
};

export const getElevationRequestSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
  })
  .required();

export const getElevationRequestController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    data: { id },
  } = ctx;

  const {
    elevation: { status },
    client,
    tenant,
  } = await getOauthElevationRequest(ctx, id);

  return { body: { status, client, tenant } };
};
