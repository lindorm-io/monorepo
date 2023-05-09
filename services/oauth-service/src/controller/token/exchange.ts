import { TokenExchangeRequestBody, TokenExchangeResponseBody } from "@lindorm-io/common-types";
import { ClientError } from "@lindorm-io/errors";
import { TokenHeaderType, parseTokenHeader } from "@lindorm-io/jwt";
import { ControllerResponse } from "@lindorm-io/koa";
import Joi from "joi";
import { OpaqueTokenType } from "../../enum";
import { convertOpaqueTokenToJwt } from "../../handler";
import { ServerKoaController } from "../../types";

type RequestData = TokenExchangeRequestBody;

type ResponseBody = TokenExchangeResponseBody;

export const tokenExchangeSchema = Joi.object<RequestData>()
  .keys({
    token: Joi.string().min(128).required(),
  })
  .options({ abortEarly: false, allowUnknown: true })
  .required();

export const tokenExchangeController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    data: { token },
    mongo: { clientRepository, clientSessionRepository },
    redis: { opaqueTokenCache },
  } = ctx;

  const { typ } = parseTokenHeader(token);

  if (typ !== TokenHeaderType.OPAQUE) {
    throw new ClientError("Invalid token", {
      debug: {
        expect: TokenHeaderType.OPAQUE,
        actual: typ,
      },
      description: "Input value is not an opaque token",
    });
  }

  const opaqueToken = await opaqueTokenCache.tryFind({ token });

  if (!opaqueToken || opaqueToken.type !== OpaqueTokenType.ACCESS) {
    throw new ClientError("Invalid Access Token", {
      code: "invalid_access_token",
      data: { token },
      statusCode: ClientError.StatusCode.UNAUTHORIZED,
    });
  }

  const clientSession = await clientSessionRepository.find({ id: opaqueToken.clientSessionId });
  const client = await clientRepository.tryFind({ id: clientSession.clientId });

  if (!client) {
    throw new ClientError("Client not found", {
      code: "invalid_client",
      statusCode: ClientError.StatusCode.FORBIDDEN,
    });
  }

  if (!client.active) {
    throw new ClientError("Inactive Client", {
      code: "inactive_client",
      statusCode: ClientError.StatusCode.FORBIDDEN,
    });
  }

  const { token: signed, expiresIn } = convertOpaqueTokenToJwt(ctx, clientSession, opaqueToken);

  return { body: { expiresIn, token: signed } };
};
