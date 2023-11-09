import { SessionStatus } from "@lindorm-io/common-enums";
import { ConfirmStrategyRequestBody, ConfirmStrategyRequestParams } from "@lindorm-io/common-types";
import { removeEmptyFromArray } from "@lindorm-io/core";
import { ClientError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import Joi from "joi";
import { flatten, uniq } from "lodash";
import { JOI_JWT } from "../../common";
import { resolveAllowedStrategies } from "../../handler";
import { getStrategyHandler } from "../../strategies";
import { ServerKoaController } from "../../types";
import { calculateAuthenticationStatus } from "../../util";

type RequestData = ConfirmStrategyRequestParams & ConfirmStrategyRequestBody;

export const confirmStrategySchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),

    challengeConfirmationToken: JOI_JWT,
    code: Joi.string(),
    otp: Joi.string(),
    password: Joi.string(),
    token: JOI_JWT,
    totp: Joi.string(),

    strategySessionToken: JOI_JWT.required(),

    remember: Joi.boolean(),
    sso: Joi.boolean(),
  })
  .options({ abortEarly: true, allowUnknown: true })
  .required();

export const confirmStrategyController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    redis: { authenticationSessionCache, strategySessionCache },
    data: { challengeConfirmationToken, code, otp, password, token, totp, remember, sso },
    entity: { authenticationSession, strategySession },
    token: { strategySessionToken },
  } = ctx;

  if (strategySessionToken.metadata.session !== strategySession.id) {
    throw new ClientError("Forbidden", {
      debug: {
        expect: strategySession.id,
        actual: strategySessionToken.metadata.session,
      },
      statusCode: ClientError.StatusCode.FORBIDDEN,
    });
  }

  if (![SessionStatus.ACKNOWLEDGED, SessionStatus.PENDING].includes(strategySession.status)) {
    throw new ClientError("Invalid Session Status");
  }

  const handler = getStrategyHandler(strategySession.strategy);
  const account = await handler.confirm(ctx, authenticationSession, strategySession, {
    challengeConfirmationToken,
    code,
    otp,
    password,
    token,
    totp,
  });

  if (authenticationSession.identityId && authenticationSession.identityId !== account.id) {
    throw new ClientError("Invalid Identity", {
      description: "Identity ID mismatch",
      debug: {
        expect: authenticationSession.identityId,
        actual: account.id,
      },
    });
  }

  authenticationSession.confirmedStrategies.push(strategySession.strategy);
  authenticationSession.confirmedIdentifiers = removeEmptyFromArray(
    uniq(flatten([authenticationSession.confirmedIdentifiers, strategySession.identifier])),
  );
  authenticationSession.identityId = account.id;

  authenticationSession.remember = remember === true;
  authenticationSession.sso = sso === true;
  authenticationSession.status = calculateAuthenticationStatus(authenticationSession, account);

  if (authenticationSession.status === SessionStatus.PENDING) {
    authenticationSession.allowedStrategies = await resolveAllowedStrategies(
      ctx,
      authenticationSession,
      account,
    );
  }

  await authenticationSessionCache.update(authenticationSession);

  strategySession.status = SessionStatus.CONFIRMED;

  await strategySessionCache.update(strategySession);
};
