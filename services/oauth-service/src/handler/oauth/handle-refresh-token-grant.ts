import { ClientError } from "@lindorm-io/errors";
import { ServerKoaContext } from "../../types";
import { configuration } from "../../server/configuration";
import { expiryDate } from "@lindorm-io/expiry";
import { generateTokenResponse } from "./generate-token-response";
import { isAfter } from "date-fns";
import { randomUUID } from "crypto";
import { LindormTokenTypes, TokenRequestBody, TokenResponse } from "@lindorm-io/common-types";

export const handleRefreshTokenGrant = async (
  ctx: ServerKoaContext<TokenRequestBody>,
): Promise<Partial<TokenResponse>> => {
  const {
    data: { refreshToken },
    entity: { client },
    jwt,
    repository: { consentSessionRepository, refreshSessionRepository },
  } = ctx;

  const { id, sessionId } = jwt.verify(refreshToken, {
    audience: client.id,
    types: [LindormTokenTypes.REFRESH],
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

  if (!consentSession.sessions.includes(refreshSession.id)) {
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

  refreshSession.expires = expiryDate(
    client.expiry.refreshToken || configuration.defaults.expiry.refresh_session,
  );

  refreshSession.tokenId = randomUUID();

  refreshSession = await refreshSessionRepository.update(refreshSession);

  return generateTokenResponse(ctx, client, refreshSession, consentSession);
};
