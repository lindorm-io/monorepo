import { ServerKoaContext } from "../../types";
import { clientCredentialsMiddleware } from "../../middleware";
import { GetIdentitySessionsResponse, IdentitySessionItem } from "@lindorm-io/common-types";
import { ClientScopes } from "../../common";

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
    const { data } = await oauthClient.get<GetIdentitySessionsResponse>(
      "/internal/identities/:id/sessions",
      {
        params: { id: identityId },
        middleware: [clientCredentialsMiddleware(oauthClient, [ClientScopes.OAUTH_IDENTITY_READ])],
      },
    );

    return data.sessions
      .filter(
        (item: IdentitySessionItem) => item.adjustedAccessLevel >= 2 && item.levelOfAssurance >= 2,
      )
      .map((item: IdentitySessionItem) => item.id);
  } catch (err) {
    return [];
  }
};
