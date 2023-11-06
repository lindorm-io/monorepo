import { PublicClientInfo, PublicTenantInfo, SessionStatus } from "@lindorm-io/common-types";
import { ControllerResponse } from "@lindorm-io/koa";
import Joi from "joi";
import { getOauthLogoutSession } from "../../../handler";
import { ServerKoaController } from "../../../types";

type RequestData = {
  id: string;
};

type ResponseBody = {
  status: SessionStatus;
  browserSession: {
    id: string;
    connectedSessions: number;
  };
  clientSession: {
    id: string | null;
  };
  client: PublicClientInfo;
  tenant: PublicTenantInfo;
};

export const getLogoutSessionSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
  })
  .required();

export const getLogoutSessionController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    data: { id },
  } = ctx;

  const {
    logout: { status, browserSession, clientSession },
    client,
    tenant,
  } = await getOauthLogoutSession(ctx, id);

  return {
    body: {
      status,
      browserSession,
      clientSession,
      client,
      tenant,
    },
  };
};
