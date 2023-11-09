import { GetIdentityRequestParams, GetIdentityResponse } from "@lindorm-io/common-types";
import { clientCredentialsMiddleware } from "../../middleware";
import { ServerKoaContext } from "../../types";

export const getIdentity = async (
  ctx: ServerKoaContext,
  id: string,
): Promise<GetIdentityResponse> => {
  const {
    axios: { identityClient },
  } = ctx;

  const { data } = await identityClient.get<GetIdentityResponse, never, GetIdentityRequestParams>(
    "/admin/identities/:id",
    {
      params: { id },
      middleware: [clientCredentialsMiddleware()],
    },
  );

  return data;
};
