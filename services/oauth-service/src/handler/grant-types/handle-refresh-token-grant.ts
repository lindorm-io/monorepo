import { OpenIdTokenRequestBody, OpenIdTokenResponseBody } from "@lindorm-io/common-types";
import { ClientError } from "@lindorm-io/errors";
import { isAfter } from "date-fns";
import { ClientSessionType, OpaqueTokenType } from "../../enum";
import { ServerKoaContext } from "../../types";
import { generateTokenResponse } from "../oauth";

export const handleRefreshTokenGrant = async (
  ctx: ServerKoaContext<OpenIdTokenRequestBody>,
): Promise<Partial<OpenIdTokenResponseBody>> => {
  const {
    data: { refreshToken: token },
    entity: { client },
    mongo: { clientSessionRepository },
    redis: { opaqueTokenCache },
  } = ctx;

  if (!token) {
    throw new ClientError("Invalid Refresh Token", {
      code: "invalid_refresh_token",
      data: { token },
      statusCode: ClientError.StatusCode.UNAUTHORIZED,
    });
  }

  const opaqueToken = await opaqueTokenCache.tryFind({ token });

  if (!opaqueToken || opaqueToken.type !== OpaqueTokenType.REFRESH) {
    throw new ClientError("Invalid Refresh Token", {
      code: "invalid_refresh_token",
      data: { token },
      statusCode: ClientError.StatusCode.UNAUTHORIZED,
    });
  }

  if (isAfter(new Date(), opaqueToken.expires)) {
    await opaqueTokenCache.destroy(opaqueToken);

    throw new ClientError("Invalid Session", {
      code: "invalid_request",
      description: "Session is expired",
      debug: {
        expect: new Date(),
        actual: opaqueToken.expires,
      },
      statusCode: ClientError.StatusCode.UNAUTHORIZED,
    });
  }

  const clientSession = await clientSessionRepository.tryFind({
    id: opaqueToken.clientSessionId,
    clientId: client.id,
  });

  if (!clientSession) {
    throw new ClientError("Unauthorized", {
      code: "invalid_request",
      description: "Session not found",
      statusCode: ClientError.StatusCode.UNAUTHORIZED,
    });
  }

  if (clientSession.type !== ClientSessionType.REFRESH) {
    throw new ClientError("Unauthorized", {
      code: "invalid_request",
      description: "Invalid Session type",
      debug: {
        expect: ClientSessionType.REFRESH,
        actual: clientSession.type,
      },
      statusCode: ClientError.StatusCode.UNAUTHORIZED,
    });
  }

  await opaqueTokenCache.destroy(opaqueToken);

  return generateTokenResponse(ctx, client, clientSession);
};
