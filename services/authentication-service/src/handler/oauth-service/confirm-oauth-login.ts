import { ServerKoaContext } from "../../types";
import { VerifiedAuthenticationConfirmationToken } from "../../common";
import { clientCredentialsMiddleware } from "../../middleware";
import {
  AuthenticationMethod,
  ConfirmLoginRequestBody,
  ConfirmLoginRequestParams,
  ConfirmLoginResponse,
} from "@lindorm-io/common-types";
import { ServerError } from "@lindorm-io/errors";

export const confirmOauthLogin = async (
  ctx: ServerKoaContext,
  authenticationConfirmationToken: VerifiedAuthenticationConfirmationToken,
): Promise<ConfirmLoginResponse> => {
  const {
    axios: { oauthClient },
  } = ctx;

  if (!authenticationConfirmationToken.session) {
    throw new ServerError("Invalid token", {
      description: "Authentication Confirmation Token created without session id",
      debug: { authenticationConfirmationToken },
    });
  }

  const body: ConfirmLoginRequestBody = {
    identityId: authenticationConfirmationToken.subject,
    levelOfAssurance: authenticationConfirmationToken.levelOfAssurance,
    metadata: {},
    methods: authenticationConfirmationToken.authMethodsReference as Array<AuthenticationMethod>,
    remember: authenticationConfirmationToken.claims.remember,
    sso: authenticationConfirmationToken.claims.sso,
  };

  const { data } = await oauthClient.post<
    ConfirmLoginResponse,
    ConfirmLoginRequestBody,
    unknown,
    ConfirmLoginRequestParams
  >("/admin/sessions/login/:id/confirm", {
    params: { id: authenticationConfirmationToken.session },
    body,
    middleware: [clientCredentialsMiddleware(oauthClient)],
  });

  return data;
};
