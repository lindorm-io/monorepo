import { axiosBearerAuthMiddleware } from "@lindorm-io/axios";
import { GetClaimsQuery, GetClaimsResponse } from "@lindorm-io/common-types";
import { configuration } from "../../server/configuration";
import { ServerKoaContext } from "../../types";

export const getIdentityUserinfo = async (
  ctx: ServerKoaContext,
  bearerToken: string,
): Promise<GetClaimsResponse> => {
  const {
    axios: { identityClient },
  } = ctx;

  const { data } = await identityClient.get<GetClaimsResponse, never, GetClaimsQuery>(
    configuration.services.identity_service.routes.userinfo,
    {
      middleware: [axiosBearerAuthMiddleware(bearerToken)],
    },
  );

  return data;
};
