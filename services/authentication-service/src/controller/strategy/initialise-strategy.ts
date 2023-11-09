import { IdentifierType } from "@lindorm-io/common-enums";
import {
  InitialiseStrategyRequestBody,
  InitialiseStrategyRequestParams,
  InitialiseStrategyResponse,
} from "@lindorm-io/common-types";
import { ClientError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import Joi from "joi";
import { JOI_AUTHENTICATION_STRATEGY } from "../../constant";
import { StrategySession } from "../../entity";
import { getStrategyHandler } from "../../strategies";
import { ServerKoaController } from "../../types";

type RequestData = InitialiseStrategyRequestParams & InitialiseStrategyRequestBody;

type ResponseBody = InitialiseStrategyResponse;

export const initialiseStrategySchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
    identifier: Joi.string().required(),
    identifierType: Joi.string()
      .valid(...Object.values(IdentifierType))
      .required(),
    nonce: Joi.string(),
    strategy: JOI_AUTHENTICATION_STRATEGY.required(),
  })
  .required();

export const initialiseStrategyController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    redis: { strategySessionCache },
    data: { identifier, identifierType, nonce, strategy },
    entity: { authenticationSession },
  } = ctx;

  if (!authenticationSession.allowedStrategies.includes(strategy)) {
    throw new ClientError("Invalid strategy");
  }

  const strategySession = await strategySessionCache.create(
    new StrategySession({
      authenticationSessionId: authenticationSession.id,
      expires: authenticationSession.expires,
      identifier,
      identifierType,
      nonce,
      strategy,
    }),
  );

  const handler = getStrategyHandler(strategy);
  const body = await handler.initialise(ctx, authenticationSession, strategySession);

  return { body };
};
