import { ClientPermission, ClientScope, GetUserinfoResponseBody } from "../../common";
import { Context } from "../../types";
import { generateAxiosBearerAuthMiddleware } from "../axios";

export const getIdentityUserinfo = async (
  ctx: Context,
  identityId: string,
  scopes: Array<string>,
): Promise<GetUserinfoResponseBody> => {
  const {
    axios: { identityClient },
  } = ctx;

  const { data } = await identityClient.get<GetUserinfoResponseBody>("/internal/userinfo/:id", {
    params: { id: identityId },
    query: { scope: scopes.join(" ") },
    middleware: [
      generateAxiosBearerAuthMiddleware(
        ctx,
        [ClientPermission.IDENTITY_CONFIDENTIAL],
        [ClientScope.IDENTITY_IDENTITY_READ],
      ),
    ],
  });

  return data;
};
