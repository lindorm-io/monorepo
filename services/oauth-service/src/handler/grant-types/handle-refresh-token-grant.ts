import { ClientError } from "@lindorm-io/errors";
import { LindormTokenTypes, TokenRequestBody, TokenResponse } from "@lindorm-io/common-types";
import { ServerKoaContext } from "../../types";
import { configuration } from "../../server/configuration";
import { expiryDate } from "@lindorm-io/expiry";
import { generateTokenResponse } from "../oauth";
import { isAfter } from "date-fns";
import { randomUUID } from "crypto";

export const handleRefreshTokenGrant = async (
  ctx: ServerKoaContext<TokenRequestBody>,
): Promise<Partial<TokenResponse>> => {
  const {
    data: { refreshToken },
    entity: { client },
    jwt,
    repository: { refreshSessionRepository },
  } = ctx;

  const { id, session } = jwt.verify(refreshToken, {
    audience: client.id,
    types: [LindormTokenTypes.REFRESH],
  });

  if (!session) {
    throw new ClientError("Invalid Refresh Token", {
      code: "invalid_refresh_token",
      description: "Token claim is missing",
      data: { session },
    });
  }

  let refreshSession = await refreshSessionRepository.find({
    id: session,
    clientId: client.id,
  });

  if (id !== refreshSession.refreshTokenId) {
    throw new ClientError("Invalid Session", {
      code: "invalid_request",
      description: "Session has been consumed",
      debug: {
        expect: refreshSession.refreshTokenId,
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

  refreshSession.expires = expiryDate(
    client.expiry.refreshToken || configuration.defaults.expiry.refresh_session,
  );

  refreshSession.refreshTokenId = randomUUID();

  refreshSession = await refreshSessionRepository.update(refreshSession);

  return generateTokenResponse(ctx, client, refreshSession);
};
