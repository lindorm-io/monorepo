import { ClientError } from "@lindorm-io/errors";
import { ServerKoaContext, OAuthTokenRequestData, OAuthTokenResponseBody } from "../../types";
import { TokenType } from "../../enum";
import { configuration } from "../../server/configuration";
import { generateTokenResponse } from "./generate-token-response";
import { getExpiryDate } from "@lindorm-io/core";
import { includes } from "lodash";
import { isAfter } from "date-fns";
import { randomUUID } from "crypto";

export const handleRefreshTokenGrant = async (
  ctx: ServerKoaContext<OAuthTokenRequestData>,
): Promise<Partial<OAuthTokenResponseBody>> => {
  const {
    data: { refreshToken },
    entity: { client },
    jwt,
    repository: { consentSessionRepository, refreshSessionRepository },
  } = ctx;

  const { id, sessionId } = jwt.verify(refreshToken, {
    audience: client.id,
    types: [TokenType.REFRESH],
  });

  let refreshSession = await refreshSessionRepository.find({
    id: sessionId,
    clientId: client.id,
  });

  if (id !== refreshSession.tokenId) {
    throw new ClientError("Invalid Session", {
      code: "invalid_request",
      description: "Session has been consumed",
      debug: {
        expect: refreshSession.tokenId,
        actual: id,
      },
      statusCode: ClientError.StatusCode.UNAUTHORIZED,
    });
  }

  if (isAfter(new Date(), refreshSession.expires)) {
    await refreshSessionRepository.destroy(refreshSession);

    throw new ClientError("Invalid Session", {
      code: "invalid_request",
      description: "Session is expired",
      debug: {
        expect: new Date(),
        actual: refreshSession.expires,
      },
      statusCode: ClientError.StatusCode.UNAUTHORIZED,
    });
  }

  const consentSession = await consentSessionRepository.find({
    clientId: client.id,
    identityId: refreshSession.identityId,
  });

  if (!includes(consentSession.sessions, refreshSession.id)) {
    throw new ClientError("Invalid Session", {
      code: "invalid_request",
      description: "Session does not have consent",
      debug: {
        expect: [refreshSession.id],
        actual: consentSession.sessions,
      },
      statusCode: ClientError.StatusCode.UNAUTHORIZED,
    });
  }

  refreshSession.expires = getExpiryDate(
    client.expiry.refreshToken || configuration.defaults.expiry.refresh_session,
  );

  refreshSession.tokenId = randomUUID();

  refreshSession = await refreshSessionRepository.update(refreshSession);

  return generateTokenResponse(ctx, client, refreshSession, consentSession.scopes);
};
