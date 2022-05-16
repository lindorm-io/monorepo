import { Account } from "../../../entity";
import { ClientScope, GetIdentitySessionsResponseBody } from "../../../common";
import { ServerKoaContext } from "../../../types";
import { clientCredentialsMiddleware } from "../../../middleware";

export const oauthGetIdentitySessions = async (
  ctx: ServerKoaContext,
  account: Account,
): Promise<GetIdentitySessionsResponseBody> => {
  const {
    axios: { oauthClient },
  } = ctx;

  const { data } = await oauthClient.get<GetIdentitySessionsResponseBody>(
    "/internal/identities/:id/sessions",
    {
      params: { id: account.id },
      middleware: [clientCredentialsMiddleware(oauthClient, [ClientScope.OAUTH_IDENTITY_READ])],
    },
  );

  return data;
};
