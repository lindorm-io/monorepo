import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { PublicClientInfo, SessionStatus } from "@lindorm-io/common-types";
import { ServerKoaController } from "../../../types";
import { getOauthLogoutSession } from "../../../handler";

type RequestData = {
  id: string;
};

type ResponseBody = {
  status: SessionStatus;
  accessSession: {
    id: string | null;
  };
  browserSession: {
    id: string;
    connectedSessions: number;
  };
  refreshSession: {
    id: string | null;
  };
  client: PublicClientInfo;
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
    logout: { status, accessSession, browserSession, refreshSession },
    client,
  } = await getOauthLogoutSession(ctx, id);

  return {
    body: {
      status,
      accessSession,
      browserSession,
      refreshSession,
      client,
    },
  };
};
