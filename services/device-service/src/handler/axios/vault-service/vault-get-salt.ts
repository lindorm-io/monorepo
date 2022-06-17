import { GetEncryptedRecordResponseBody } from "../../../common";
import { DeviceLink } from "../../../entity";
import { DeviceLinkSalt, ServerKoaContext } from "../../../types";
import { clientCredentialsMiddleware } from "../../../middleware";

export const vaultGetSalt = async (
  ctx: ServerKoaContext,
  deviceLink: DeviceLink,
): Promise<DeviceLinkSalt> => {
  const {
    axios: { oauthClient, vaultClient },
  } = ctx;

  const response = await vaultClient.get<GetEncryptedRecordResponseBody<DeviceLinkSalt>>(
    "/internal/vault/:id",
    {
      params: {
        id: deviceLink.id,
      },
      middleware: [clientCredentialsMiddleware(oauthClient)],
    },
  );

  return response.data.data;
};
