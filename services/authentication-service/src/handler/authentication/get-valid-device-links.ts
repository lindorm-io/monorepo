import { ServerKoaContext } from "../../types";
import { clientCredentialsMiddleware } from "../../middleware";
import { GetIdentityDeviceLinksResponse } from "@lindorm-io/common-types";
import { ClientScopes } from "../../common";

export const getValidDeviceLinks = async (
  ctx: ServerKoaContext,
  identityId?: string,
): Promise<Array<string>> => {
  const {
    axios: { deviceClient, oauthClient },
  } = ctx;

  if (!identityId) {
    return [];
  }

  try {
    const { data } = await deviceClient.get<GetIdentityDeviceLinksResponse>(
      "/internal/identities/:id/device-links",
      {
        params: { id: identityId },
        middleware: [clientCredentialsMiddleware(oauthClient, [ClientScopes.DEVICE_IDENTITY_READ])],
      },
    );

    return data.deviceLinks;
  } catch (err) {
    return [];
  }
};
