import { ClientError } from "@lindorm-io/errors";
import { ServerKoaContext } from "../../types";
import { createClientCredentialsToken } from "../token";
import { difference } from "lodash";
import { TokenRequestBody } from "@lindorm-io/common-types";

type ResponseBody = {
  accessToken: string;
  expiresIn: number;
  scope: Array<string>;
  tokenType: string;
};

export const handleClientCredentialsGrant = async (
  ctx: ServerKoaContext<TokenRequestBody>,
): Promise<ResponseBody> => {
  const {
    data: { scope },
    entity: { client },
  } = ctx;

  if (!client.active) {
    throw new ClientError("Invalid client", {
      code: "invalid_request",
      description: "Client is blocked",
      statusCode: ClientError.StatusCode.UNAUTHORIZED,
    });
  }

  const scopes = scope.split(" ");
  const diff = difference(scopes, client.allowed.scopes);

  if (diff.length) {
    throw new ClientError("Invalid scope", {
      code: "invalid_request",
      description: "Invalid scope",
      debug: {
        expect: client.allowed.scopes,
        actual: scopes,
        diff,
      },
      statusCode: ClientError.StatusCode.FORBIDDEN,
    });
  }

  const { token: accessToken, expiresIn } = createClientCredentialsToken(ctx, client, scopes);

  return {
    accessToken,
    expiresIn,
    scope: scopes,
    tokenType: "Bearer",
  };
};
