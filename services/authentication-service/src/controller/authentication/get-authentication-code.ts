import {
  GetAuthenticationCodeRequestParams,
  GetAuthenticationCodeResponse,
  SessionStatus,
} from "@lindorm-io/common-types";
import { ClientError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import { randomString } from "@lindorm-io/random";
import Joi from "joi";
import { argon } from "../../instance";
import { ServerKoaController } from "../../types";

type RequestData = GetAuthenticationCodeRequestParams;

type ResponseBody = GetAuthenticationCodeResponse;

export const getAuthenticationCodeSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
  })
  .required();

export const getAuthenticationCodeController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    redis: { authenticationSessionCache },
    entity: { authenticationSession },
  } = ctx;

  if (![SessionStatus.CODE, SessionStatus.CONFIRMED].includes(authenticationSession.status)) {
    throw new ClientError("Invalid Session Status", {
      debug: { status: authenticationSession.status },
    });
  }

  const code = randomString(64);

  authenticationSession.code = await argon.encrypt(code);
  authenticationSession.status = SessionStatus.CODE;

  await authenticationSessionCache.update(authenticationSession);

  return { body: { code, mode: authenticationSession.mode } };
};
