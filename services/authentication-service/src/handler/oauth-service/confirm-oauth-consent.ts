import { ServerKoaContext } from "../../types";
import { clientCredentialsMiddleware } from "../../middleware";
import { ClientScopes } from "../../common";
import {
  ConfirmConsentRequestBody,
  ConfirmConsentRequestParams,
  ConfirmConsentResponse,
} from "@lindorm-io/common-types";

export const confirmOauthConsent = async (
  ctx: ServerKoaContext,
  id: string,
  body: ConfirmConsentRequestBody,
): Promise<ConfirmConsentResponse> => {
  const {
    axios: { oauthClient },
  } = ctx;

  const { data } = await oauthClient.post<
    ConfirmConsentResponse,
    ConfirmConsentRequestBody,
    unknown,
    ConfirmConsentRequestParams
  >("/admin/sessions/consent/:id/confirm", {
    params: { id },
    body,
    middleware: [clientCredentialsMiddleware(oauthClient, [ClientScopes.OAUTH_CONSENT_WRITE])],
  });

  return data;
};
