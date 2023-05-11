import { ClientError } from "@lindorm-io/errors";
import { decodeOpaqueToken } from "@lindorm-io/jwt";
import { AuthenticationConfirmationToken } from "../../entity";
import { ServerKoaContext } from "../../types";

export const resolveAuthenticationConfirmationToken = async (
  ctx: ServerKoaContext,
  token: string,
): Promise<AuthenticationConfirmationToken> => {
  const {
    redis: { authenticationConfirmationTokenCache },
  } = ctx;

  const { id, signature } = decodeOpaqueToken(token);

  const authenticationConfirmationToken = await authenticationConfirmationTokenCache.tryFind({
    id,
  });

  if (!authenticationConfirmationToken) {
    throw new ClientError("Invalid token", {
      description: "Token ID not found in cache",
      statusCode: ClientError.StatusCode.FORBIDDEN,
    });
  }

  if (signature !== authenticationConfirmationToken.signature) {
    throw new ClientError("Invalid token", {
      debug: {
        expect: authenticationConfirmationToken.signature,
        actual: signature,
      },
      statusCode: ClientError.StatusCode.FORBIDDEN,
    });
  }

  return authenticationConfirmationToken;
};
