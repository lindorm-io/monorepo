import { ClientError } from "@lindorm-io/errors";
import { ClientSessionType, OpaqueTokenType } from "../../enum";
import { ServerKoaContext } from "../../types";
import { TokenRequestBody, TokenResponse } from "@lindorm-io/common-types";
import { generateTokenResponse } from "../oauth";
import { isAfter } from "date-fns";
import { resolveTokenSession } from "../token";

export const handleRefreshTokenGrant = async (
  ctx: ServerKoaContext<TokenRequestBody>,
): Promise<Partial<TokenResponse>> => {
  const {
    cache: { opaqueTokenCache },
    data: { refreshToken: token },
    entity: { client },
    repository: { clientSessionRepository },
  } = ctx;

  const opaqueToken = await resolveTokenSession(ctx, token);

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

  const clientSession = await clientSessionRepository.find({
    id: opaqueToken.clientSessionId,
    clientId: client.id,
  });

  if (clientSession.type !== ClientSessionType.REFRESH) {
    throw new ClientError("Invalid Session", {
      code: "invalid_request",
      description: "Session is ephemeral",
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
