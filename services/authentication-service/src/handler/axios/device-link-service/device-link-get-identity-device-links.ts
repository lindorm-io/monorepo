import { Account } from "../../../entity";
import { ClientScope, GetIdentityDeviceLinksResponseBody } from "../../../common";
import { Context } from "../../../types";
import { clientCredentialsMiddleware } from "../../../middleware";

export const deviceLinkGetIdentityDeviceLinks = async (
  ctx: Context,
  account: Account,
): Promise<GetIdentityDeviceLinksResponseBody> => {
  const {
    axios: { deviceLinkClient, oauthClient },
  } = ctx;

  const { data } = await deviceLinkClient.get<GetIdentityDeviceLinksResponseBody>(
    "/internal/identities/:id/device-links",
    {
      params: { id: account.id },
      middleware: [clientCredentialsMiddleware(oauthClient, [ClientScope.DEVICE_IDENTITY_READ])],
    },
  );

  return data;
};
