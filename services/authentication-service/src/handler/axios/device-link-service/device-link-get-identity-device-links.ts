import { Account } from "../../../entity";
import { ClientScope, GetIdentityDeviceLinksResponseBody } from "../../../common";
import { ServerKoaContext } from "../../../types";
import { clientCredentialsMiddleware } from "../../../middleware";

export const deviceLinkGetIdentityDeviceLinks = async (
  ctx: ServerKoaContext,
  account: Account,
): Promise<GetIdentityDeviceLinksResponseBody> => {
  const {
    axios: { deviceClient, oauthClient },
  } = ctx;

  const { data } = await deviceClient.get<GetIdentityDeviceLinksResponseBody>(
    "/internal/identities/:id/device-links",
    {
      params: { id: account.id },
      middleware: [clientCredentialsMiddleware(oauthClient, [ClientScope.DEVICE_IDENTITY_READ])],
    },
  );

  return data;
};
