import { ServerKoaContext } from "../../types";
import { clientCredentialsMiddleware } from "../../middleware";
import { AddUserinfoRequestBody } from "@lindorm-io/common-types";

export const updateIdentityUserinfo = async (
  ctx: ServerKoaContext,
  identityId: string,
  body: Partial<AddUserinfoRequestBody>,
): Promise<void> => {
  const {
    axios: { identityClient, oauthClient },
  } = ctx;

  await identityClient.put("/admin/userinfo/:id", {
    body,
    params: { id: identityId },
    middleware: [clientCredentialsMiddleware(oauthClient)],
  });
};
