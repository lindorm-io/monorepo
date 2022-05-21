import { ClientScope, GetEncryptedRecordResponseBody } from "../../../common";
import { DeviceLink } from "../../../entity";
import { DeviceLinkSalt, ServerKoaContext } from "../../../types";
import { clientCredentialsMiddleware } from "../../../middleware";

export const vaultDeleteSalt = async (
  ctx: ServerKoaContext,
  deviceLink: DeviceLink,
): Promise<void> => {
  const {
    axios: { oauthClient, vaultClient },
  } = ctx;

  await vaultClient.delete<GetEncryptedRecordResponseBody<DeviceLinkSalt>>("/internal/vault/:id", {
    params: {
      id: deviceLink.id,
    },
    middleware: [
      clientCredentialsMiddleware(oauthClient, [ClientScope.VAULT_ENCRYPTED_RECORD_READ]),
    ],
  });
};
