import { ClientPermission, GetUserinfoResponseBody } from "../../common";
import { ServerKoaContext } from "../../types";
import { generateAxiosBearerAuthMiddleware } from "../axios";

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
    middleware: [generateAxiosBearerAuthMiddleware(ctx, [ClientPermission.IDENTITY_CONFIDENTIAL])],
  });

  return data;
};
