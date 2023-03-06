import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../types";
import { TokenExchangeRequestBody, TokenExchangeResponseBody } from "@lindorm-io/common-types";
import { convertOpaqueTokenToJwt, resolveTokenSession } from "../../handler";

type RequestData = TokenExchangeRequestBody;

type ResponseBody = TokenExchangeResponseBody;

export const tokenExchangeSchema = Joi.object<RequestData>()
  .keys({
    token: Joi.string().required(),
  })
  .required();

export const tokenExchangeController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    data: { token },
    repository: { clientRepository, clientSessionRepository },
  } = ctx;

  const opaqueToken = await resolveTokenSession(ctx, token);
  const clientSession = await clientSessionRepository.find({ id: opaqueToken.clientSessionId });
  await clientRepository.find({ id: clientSession.clientId, active: true });

  const { token: jwt, expiresIn } = convertOpaqueTokenToJwt(ctx, clientSession, opaqueToken);

  return { body: { jwt, expiresIn } };
};
