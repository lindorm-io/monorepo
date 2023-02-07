import Joi from "joi";
import { ServerKoaController } from "../../types";
import { ControllerResponse } from "@lindorm-io/koa";
import { filter, orderBy } from "lodash";
import { expiryObject } from "@lindorm-io/expiry";
import {
  GetPendingRdcRequestParams,
  GetPendingRdcResponse,
  PendingRdcSession,
  RdcSessionModes,
  SessionStatuses,
} from "@lindorm-io/common-types";

type RequestData = GetPendingRdcRequestParams;

type ResponseBody = GetPendingRdcResponse;

export const getPendingRdcSessionsSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
  })
  .required();

export const getPendingRdcSessionsController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    cache: { rdcSessionCache },
    data: { id: identityId },
  } = ctx;

  const result = await rdcSessionCache.findMany({ identityId });
  const filtered = filter(result, {
    mode: RdcSessionModes.PUSH_NOTIFICATION,
    status: SessionStatuses.PENDING,
  });
  const pending = orderBy(filtered, ["created"], ["desc"]);
  const sessions: Array<PendingRdcSession> = [];

  for (const item of pending) {
    const { expiresIn } = expiryObject(item.expires);

    sessions.push({
      id: item.id,
      expiresIn,
    });
  }

  return { body: { sessions } };
};
