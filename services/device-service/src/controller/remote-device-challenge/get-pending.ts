import Joi from "joi";
import { ClientError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../types";
import { orderBy } from "lodash";
import {
  GetPendingRdcRequestParams,
  GetPendingRdcResponse,
  RdcSessionMode,
  SessionStatus,
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
    token: { bearerToken },
  } = ctx;

  if (identityId !== bearerToken.subject) {
    throw new ClientError("Invalid bearer token");
  }

  const result = await rdcSessionCache.findMany({ identityId });
  const filtered = result.filter(
    (x) => x.mode === RdcSessionMode.PUSH_NOTIFICATION && x.status === SessionStatus.PENDING,
  );
  const pending = orderBy(filtered, ["created"], ["desc"]);

  return {
    body: {
      sessions: pending.map((x) => ({
        id: x.id,
        expires: x.expires.toISOString(),
      })),
    },
  };
};
