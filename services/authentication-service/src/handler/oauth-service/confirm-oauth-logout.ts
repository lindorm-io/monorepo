import { ServerKoaContext } from "../../types";
import { clientCredentialsMiddleware } from "../../middleware";
import { ClientScopes } from "../../common";
import {
  ConfirmLogoutRequestBody,
  ConfirmLogoutRequestParams,
  ConfirmLogoutResponse,
} from "@lindorm-io/common-types";

export const confirmOauthLogout = async (
  ctx: ServerKoaContext,
  id: string,
  body: ConfirmLogoutRequestBody,
): Promise<ConfirmLogoutResponse> => {
  const {
    axios: { oauthClient },
  } = ctx;

  const { data } = await oauthClient.post<
    ConfirmLogoutResponse,
    ConfirmLogoutRequestBody,
    unknown,
    ConfirmLogoutRequestParams
  >("/admin/sessions/logout/:id/confirm", {
    params: { id },
    body,
    middleware: [clientCredentialsMiddleware(oauthClient, [ClientScopes.OAUTH_CONSENT_WRITE])],
  });

  return data;
};
