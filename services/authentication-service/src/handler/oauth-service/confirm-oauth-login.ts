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

  const {
    factors,
    identityId,
    levelOfAssurance,
    metadata,
    methods,
    remember,
    singleSignOn,
    strategies,
  } = authenticationConfirmationToken;

  const { data } = await oauthClient.post<
    ConfirmLoginResponse,
    ConfirmLoginRequestBody,
    unknown,
    ConfirmLoginRequestParams
  >("/admin/sessions/login/:id/confirm", {
    params: { id: authenticationConfirmationToken.sessionId },
    body: {
      factors,
      identityId,
      levelOfAssurance,
      metadata,
      methods,
      remember,
      singleSignOn,
      strategies,
    },
    middleware: [clientCredentialsMiddleware()],
  });

  return data;
};
