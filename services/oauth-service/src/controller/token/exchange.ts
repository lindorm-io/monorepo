import { TokenExchangeRequestBody, TokenExchangeResponseBody } from "@lindorm-io/common-types";
import { ControllerResponse } from "@lindorm-io/koa";
import Joi from "joi";
import { convertOpaqueTokenToJwt, resolveTokenSession } from "../../handler";
import { ServerKoaController } from "../../types";

type RequestData = TokenExchangeRequestBody;

type ResponseBody = TokenExchangeResponseBody;

export const tokenExchangeSchema = Joi.object<RequestData>()
  .keys({
    token: Joi.string().min(128).required(),
  })
  .required();

export const tokenExchangeController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    data: { token },
    mongo: { clientRepository, clientSessionRepository },
  } = ctx;

  const opaqueToken = await resolveTokenSession(ctx, token);
  const clientSession = await clientSessionRepository.find({ id: opaqueToken.clientSessionId });
  await clientRepository.find({ id: clientSession.clientId, active: true });

  const { token: signed, expiresIn } = convertOpaqueTokenToJwt(ctx, clientSession, opaqueToken);

  return { body: { expiresIn, token: signed } };
};
