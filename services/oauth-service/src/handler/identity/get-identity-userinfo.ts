import { GetClaimsQuery, GetClaimsResponse } from "@lindorm-io/common-types";
import { ServerKoaContext } from "../../types";
import { axiosBearerAuthMiddleware } from "@lindorm-io/axios";
import { configuration } from "../../server/configuration";

export const getIdentityUserinfo = async (
  ctx: ServerKoaContext,
  bearerToken: string,
): Promise<GetClaimsResponse> => {
  const {
    axios: { identityClient },
  } = ctx;

  const { data } = await identityClient.get<GetClaimsResponse, never, GetClaimsQuery>(
    configuration.redirect.userinfo,
    {
      middleware: [axiosBearerAuthMiddleware(bearerToken)],
    },
  );

  return data;
};
