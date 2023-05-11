import {
  ConfirmLoginRequestBody,
  ConfirmLoginRequestParams,
  ConfirmLoginResponse,
} from "@lindorm-io/common-types";
import { AuthenticationConfirmationToken } from "../../entity";
import { clientCredentialsMiddleware } from "../../middleware";
import { ServerKoaContext } from "../../types";

export const confirmOauthLogin = async (
  ctx: ServerKoaContext,
  authenticationConfirmationToken: AuthenticationConfirmationToken,
): Promise<ConfirmLoginResponse> => {
  const {
    axios: { oauthClient },
  } = ctx;

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
