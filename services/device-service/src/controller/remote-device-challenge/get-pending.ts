import Joi from "joi";
import { ServerKoaController } from "../../types";
import { ControllerResponse } from "@lindorm-io/koa";
import { JOI_GUID, RdcSessionMode, SessionStatus } from "../../common";
import { filter, orderBy } from "lodash";
import { expiryObject } from "@lindorm-io/expiry";

interface RequestData {
  id: string;
}

interface Session {
  id: string;
  expiresIn: number;
}

interface ResponseBody {
  sessions: Array<Session>;
}

export const getPendingRdcSessionsSchema = Joi.object<RequestData>()
  .keys({
    id: JOI_GUID.required(),
  })
  .required();

export const getPendingRdcSessionsController: ServerKoaController = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    cache: { rdcSessionCache },
    data: { id: identityId },
  } = ctx;

  const result = await rdcSessionCache.findMany({ identityId });
  const filtered = filter(result, {
    mode: RdcSessionMode.PUSH_NOTIFICATION,
    status: SessionStatus.PENDING,
  });
  const pending = orderBy(filtered, ["created"], ["desc"]);
  const sessions: Array<Session> = [];

  for (const item of pending) {
    const { expiresIn } = expiryObject(item.expires);

    sessions.push({
      id: item.id,
      expiresIn,
    });
  }

  return { body: { sessions } };
};
