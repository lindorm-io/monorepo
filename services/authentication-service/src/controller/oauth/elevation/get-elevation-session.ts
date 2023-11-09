import { SessionStatus } from "@lindorm-io/common-enums";
import { PublicClientInfo, PublicTenantInfo } from "@lindorm-io/common-types";
import { ControllerResponse } from "@lindorm-io/koa";
import Joi from "joi";
import { getOauthElevationSession } from "../../../handler";
import { ServerKoaController } from "../../../types";

type RequestData = {
  id: string;
};

type ResponseBody = {
  status: SessionStatus;
  client: PublicClientInfo;
  tenant: PublicTenantInfo;
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
    elevation: { status },
    client,
    tenant,
  } = await getOauthElevationSession(ctx, id);

  return { body: { status, client, tenant } };
};
