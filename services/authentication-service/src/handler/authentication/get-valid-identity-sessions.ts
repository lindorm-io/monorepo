import { GetIdentitySessionsResponseBody } from "../../common";
import { ServerKoaContext } from "../../types";
import { clientCredentialsMiddleware } from "../../middleware";

export const getValidIdentitySessions = async (
  ctx: ServerKoaContext,
  identityId?: string,
): Promise<Array<string>> => {
  const {
    axios: { oauthClient },
  } = ctx;

  if (!identityId) {
    return [];
  }

  try {
    const { data } = await oauthClient.get<GetIdentitySessionsResponseBody>(
      "/internal/identities/:id/sessions",
      {
        params: { id: identityId },
        middleware: [clientCredentialsMiddleware(oauthClient)],
      },
    );

    return data.sessions.filter((item) => item.levelOfAssurance >= 2).map((item) => item.id);
  } catch (err) {
    return [];
  }
};
