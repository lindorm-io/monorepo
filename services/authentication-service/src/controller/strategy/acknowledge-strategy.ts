import Joi from "joi";
import { ClientError } from "@lindorm-io/errors";
import { Controller, ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaContext } from "../../types";
import { argon } from "../../instance";
import { createStrategySessionToken } from "../../handler";
import { randomSecret } from "@lindorm-io/random";
import {
  AcknowledgeStrategyRequestParams,
  AcknowledgeStrategyResponse,
  AuthenticationStrategy,
  SessionStatus,
} from "@lindorm-io/common-types";

export const acknowledgeStrategySchema = Joi.object<AcknowledgeStrategyRequestParams>()
  .keys({
    id: Joi.string().guid().required(),
  })
  .required();

export const acknowledgeStrategyController: Controller<
  ServerKoaContext,
  AcknowledgeStrategyResponse
> = async (ctx): ControllerResponse<AcknowledgeStrategyResponse> => {
  const {
    cache: { strategySessionCache },
    token: { bearerToken },
  } = ctx;

  let {
    entity: { strategySession },
  } = ctx;

  if (strategySession.status !== SessionStatus.PENDING) {
    throw new ClientError("Invalid session status");
  }

  if (![AuthenticationStrategy.SESSION_QR_CODE].includes(strategySession.strategy)) {
    throw new ClientError("Invalid strategy");
  }

  const code = randomSecret(32);

  strategySession.secret = await argon.encrypt(code);
  strategySession.identityId = bearerToken.subject;
  strategySession.status = SessionStatus.ACKNOWLEDGED;

  strategySession = await strategySessionCache.update(strategySession);

  const strategySessionToken = createStrategySessionToken(ctx, strategySession);

  return { body: { code, strategySessionToken } };
};
