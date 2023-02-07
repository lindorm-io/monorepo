import { ServerKoaContext } from "../types";
import { clientCredentialsMiddleware } from "../middleware";
import { ClientScopes } from "../common";
import { AddUserinfoRequestBody } from "@lindorm-io/common-types";

export const axiosUpdateIdentityUserinfo = async (
  ctx: ServerKoaContext,
  identityId: string,
  body: Partial<AddUserinfoRequestBody>,
): Promise<void> => {
  const {
    axios: { identityClient, oauthClient },
  } = ctx;

  await identityClient.put("/internal/userinfo/:id", {
    body,
    params: { id: identityId },
    middleware: [clientCredentialsMiddleware(oauthClient, [ClientScopes.IDENTITY_IDENTITY_WRITE])],
  });
};
