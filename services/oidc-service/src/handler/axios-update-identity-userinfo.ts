import { ServerKoaContext } from "../types";
import { AddUserinfoRequestBody } from "../common";
import { clientCredentialsMiddleware } from "../middleware";

export const axiosUpdateIdentityUserinfo = async (
  ctx: ServerKoaContext,
  identityId: string,
  options: Partial<AddUserinfoRequestBody>,
): Promise<void> => {
  const {
    axios: { identityClient, oauthClient },
  } = ctx;

  await identityClient.put("/internal/userinfo/:id", {
    body: options,
    params: { id: identityId },
    middleware: [clientCredentialsMiddleware(oauthClient)],
  });
};
