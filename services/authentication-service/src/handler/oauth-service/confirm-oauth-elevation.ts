import { ServerError } from "@lindorm-io/errors";
import { ServerKoaContext } from "../../types";
import { VerifiedAuthenticationConfirmationToken } from "../../common";
import { clientCredentialsMiddleware } from "../../middleware";
import {
  AuthenticationMethod,
  ConfirmElevationRequestBody,
  ConfirmElevationRequestParams,
  ConfirmElevationResponse,
} from "@lindorm-io/common-types";

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

  const body: ConfirmElevationRequestBody = {
    identityId: authenticationConfirmationToken.subject,
    levelOfAssurance: authenticationConfirmationToken.levelOfAssurance,
    methods: authenticationConfirmationToken.authMethodsReference as Array<AuthenticationMethod>,
  };

  const { data } = await oauthClient.post<
    ConfirmElevationResponse,
    ConfirmElevationRequestBody,
    unknown,
    ConfirmElevationRequestParams
  >("/admin/sessions/elevation/:id/confirm", {
    params: { id: authenticationConfirmationToken.session },
    body,
    middleware: [clientCredentialsMiddleware()],
  });

  return data;
};
