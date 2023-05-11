import { TokenExchangeRequestBody, TokenExchangeResponseBody } from "@lindorm-io/common-types";
import { ClientError } from "@lindorm-io/errors";
import { TokenHeaderType, decodeOpaqueToken, getTokenHeaderType } from "@lindorm-io/jwt";
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

  const type = getTokenHeaderType(token);

  if (type !== TokenHeaderType.OPAQUE) {
    throw new ClientError("Invalid token", {
      debug: {
        expect: TokenHeaderType.OPAQUE,
        actual: type,
      },
      description: "Input value is not an opaque token",
    });
  }

  const { id, signature } = decodeOpaqueToken(token);
  const opaqueToken = await opaqueTokenCache.tryFind({ id });

  if (!opaqueToken) {
    throw new ClientError("Invalid Access Token", {
      code: "invalid_access_token",
      data: { token },
      description: "Invalid token identifier",
      statusCode: ClientError.StatusCode.UNAUTHORIZED,
    });
  }

  if (opaqueToken.type !== OpaqueTokenType.ACCESS) {
    throw new ClientError("Invalid Access Token", {
      code: "invalid_access_token",
      data: { token },
      description: "Invalid token type",
      statusCode: ClientError.StatusCode.UNAUTHORIZED,
    });
  }

  if (signature !== opaqueToken.signature) {
    throw new ClientError("Invalid Access Token", {
      code: "invalid_access_token",
      data: { token },
      description: "Invalid token signature",
      statusCode: ClientError.StatusCode.UNAUTHORIZED,
    });
  }

  const clientSession = await clientSessionRepository.tryFind({ id: opaqueToken.clientSessionId });

  if (!clientSession) {
    throw new ClientError("Session not found", {
      code: "invalid_session",
      statusCode: ClientError.StatusCode.FORBIDDEN,
    });
  }

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
