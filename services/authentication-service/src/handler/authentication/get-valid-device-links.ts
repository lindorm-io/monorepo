import { ClientScope, GetIdentityDeviceLinksResponseBody } from "../../common";
import { ServerKoaContext } from "../../types";
import { clientCredentialsMiddleware } from "../../middleware";

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
    const { data } = await deviceClient.get<GetIdentityDeviceLinksResponseBody>(
      "/internal/identities/:id/device-links",
      {
        params: { id: identityId },
        middleware: [clientCredentialsMiddleware(oauthClient, [ClientScope.DEVICE_IDENTITY_READ])],
      },
    );

    return data.deviceLinks;
  } catch (err) {
    return [];
  }
};
