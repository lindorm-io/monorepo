import { ClientPermission, ClientScope, GetUserinfoResponseBody } from "../../common";
import { ServerKoaContext } from "../../types";
import { generateAxiosBearerAuthMiddleware } from "../axios";
import { configuration } from "../../server/configuration";

export const getIdentityUserinfo = async (
  ctx: ServerKoaContext,
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
        [configuration.services.identity_service.client_id],
        [ClientScope.IDENTITY_IDENTITY_READ],
      ),
    ],
  });

  return data;
};
