import {
  ConfirmElevationResponse,
  ConfirmElevationSessionRequestBody,
  ConfirmElevationSessionRequestParams,
} from "@lindorm-io/common-types";
import { AuthenticationConfirmationToken } from "../../entity";
import { clientCredentialsMiddleware } from "../../middleware";
import { ServerKoaContext } from "../../types";

export const confirmOauthElevation = async (
  ctx: ServerKoaContext,
  authenticationConfirmationToken: AuthenticationConfirmationToken,
): Promise<ConfirmElevationResponse> => {
  const {
    axios: { oauthClient },
  } = ctx;

  const body: ConfirmElevationSessionRequestBody = {
    identityId: authenticationConfirmationToken.identityId,
    levelOfAssurance: authenticationConfirmationToken.levelOfAssurance,
    methods: authenticationConfirmationToken.methods,
  };

  const { data } = await oauthClient.post<
    ConfirmElevationResponse,
    ConfirmElevationSessionRequestBody,
    unknown,
    ConfirmElevationSessionRequestParams
  >("/admin/sessions/elevation/:id/confirm", {
    params: { id: authenticationConfirmationToken.sessionId },
    body,
    middleware: [clientCredentialsMiddleware()],
  });

  return data;
};
