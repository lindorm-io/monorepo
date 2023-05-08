import {
  ConfirmLoginRequestBody,
  ConfirmLoginRequestParams,
  ConfirmLoginResponse,
} from "@lindorm-io/common-types";
import { ServerError } from "@lindorm-io/errors";
import { clientCredentialsMiddleware } from "../../middleware";
import { ServerKoaContext } from "../../types";

export const confirmOauthLogin = async (
  ctx: ServerKoaContext,
  token: string,
): Promise<ConfirmLoginResponse> => {
  const {
    axios: { oauthClient },
    redis: { authenticationConfirmationTokenCache },
  } = ctx;

  const authenticationConfirmationToken = await authenticationConfirmationTokenCache.tryFind({
    token,
  });

  if (!authenticationConfirmationToken) {
    throw new ServerError("Invalid token", {
      description: "Authentication Confirmation Token created without session id",
      debug: { authenticationConfirmationToken },
    });
  }

  const { identityId, levelOfAssurance, metadata, methods, remember, singleSignOn } =
    authenticationConfirmationToken;

  const { data } = await oauthClient.post<
    ConfirmLoginResponse,
    ConfirmLoginRequestBody,
    unknown,
    ConfirmLoginRequestParams
  >("/admin/sessions/login/:id/confirm", {
    params: { id: authenticationConfirmationToken.sessionId },
    body: {
      identityId,
      levelOfAssurance,
      metadata,
      methods,
      remember,
      singleSignOn,
    },
    middleware: [clientCredentialsMiddleware()],
  });

  return data;
};
