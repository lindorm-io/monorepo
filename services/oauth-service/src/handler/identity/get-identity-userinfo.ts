import { ServerKoaContext } from "../../types";
import { GetUserinfoResponse } from "@lindorm-io/common-types";
import { axiosBearerAuthMiddleware } from "@lindorm-io/axios";

export const getIdentityUserinfo = async (
  ctx: ServerKoaContext,
  accessToken: string,
): Promise<GetUserinfoResponse> => {
  const {
    axios: { identityClient },
  } = ctx;

  const { data } = await identityClient.get<GetUserinfoResponse>("/userinfo", {
    middleware: [axiosBearerAuthMiddleware(accessToken)],
  });

  return data;
};
