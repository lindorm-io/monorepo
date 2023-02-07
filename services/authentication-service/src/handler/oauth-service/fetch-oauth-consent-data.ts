import { ServerKoaContext } from "../../types";
import { clientCredentialsMiddleware } from "../../middleware";
import { ClientScopes } from "../../common";
import { GetConsentResponse } from "@lindorm-io/common-types";

export const fetchOauthConsentData = async (
  ctx: ServerKoaContext,
  sessionId: string,
): Promise<GetConsentResponse> => {
  const {
    axios: { oauthClient },
  } = ctx;

  const { data } = await oauthClient.get<GetConsentResponse>("/internal/sessions/consent/:id", {
    params: { id: sessionId },
    middleware: [clientCredentialsMiddleware(oauthClient, [ClientScopes.OAUTH_CONSENT_READ])],
  });

  return data;
};
