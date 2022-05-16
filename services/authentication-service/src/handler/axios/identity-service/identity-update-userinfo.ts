import { ServerKoaContext } from "../../../types";
import { ClientScope, AddUserinfoRequestBody } from "../../../common";
import { clientCredentialsMiddleware } from "../../../middleware";

export const identityUpdateUserinfo = async (
  ctx: ServerKoaContext,
  identityId: string,
  options: Partial<AddUserinfoRequestBody>,
): Promise<void> => {
  const {
    axios: { identityClient, oauthClient },
  } = ctx;

  await identityClient.put("/internal/userinfo/:id", {
    data: options,
    params: { id: identityId },
    middleware: [clientCredentialsMiddleware(oauthClient, [ClientScope.IDENTITY_IDENTITY_WRITE])],
  });
};
