import {
  AuthenticationMethod,
  ConfirmElevationResponse,
  ConfirmElevationSessionRequestBody,
  ConfirmElevationSessionRequestParams,
} from "@lindorm-io/common-types";
import { ServerError } from "@lindorm-io/errors";
import { VerifiedAuthenticationConfirmationToken } from "../../common";
import { clientCredentialsMiddleware } from "../../middleware";
import { ServerKoaContext } from "../../types";

export const confirmOauthElevation = async (
  ctx: ServerKoaContext,
  authenticationConfirmationToken: VerifiedAuthenticationConfirmationToken,
): Promise<ConfirmElevationResponse> => {
  const {
    axios: { oauthClient },
  } = ctx;

  if (!authenticationConfirmationToken.session) {
    throw new ServerError("Invalid token", {
      description: "Authentication confirmation token created without session id",
      debug: { authenticationConfirmationToken },
    });
  }

  const body: ConfirmElevationSessionRequestBody = {
    identityId: authenticationConfirmationToken.subject,
    levelOfAssurance: authenticationConfirmationToken.levelOfAssurance,
    methods: authenticationConfirmationToken.authMethodsReference as Array<AuthenticationMethod>,
  };

  const { data } = await oauthClient.post<
    ConfirmElevationResponse,
    ConfirmElevationSessionRequestBody,
    unknown,
    ConfirmElevationSessionRequestParams
  >("/admin/sessions/elevation/:id/confirm", {
    params: { id: authenticationConfirmationToken.session },
    body,
    middleware: [clientCredentialsMiddleware()],
  });

  return data;
};
