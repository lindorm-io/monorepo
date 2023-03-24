import Joi from "joi";
import { ClientError } from "@lindorm-io/errors";
import { Controller, ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaContext } from "../../types";
import {
  AcknowledgeStrategyRequestBody,
  AcknowledgeStrategyRequestParams,
  AcknowledgeStrategyResponse,
  SessionStatus,
} from "@lindorm-io/common-types";
import { getStrategyHandler } from "../../strategies";

type RequestData = AcknowledgeStrategyRequestParams & AcknowledgeStrategyRequestBody;

type ResponseBody = AcknowledgeStrategyResponse;

export const acknowledgeStrategySchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
    acknowledgeCode: Joi.string().required(),
  })
  .required();

export const acknowledgeStrategyController: Controller<
  ServerKoaContext<RequestData>,
  ResponseBody
> = async (ctx): ControllerResponse<ResponseBody> => {
  const {
    data: { acknowledgeCode },
    entity: { authenticationSession, strategySession },
    token: { bearerToken },
  } = ctx;

  if (strategySession.status !== SessionStatus.PENDING) {
    throw new ClientError("Invalid session status");
  }

  const handler = getStrategyHandler(strategySession.strategy);
  const body = await handler.acknowledge(ctx, authenticationSession, strategySession, {
    identityId: bearerToken.subject,
    acknowledgeCode,
  });

  return { body };
};
