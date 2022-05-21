import { ClientScope, CreateEncryptedRecordRequestBody } from "../../../common";
import { DeviceLink } from "../../../entity";
import { DeviceLinkSalt, ServerKoaContext } from "../../../types";
import { clientCredentialsMiddleware } from "../../../middleware";

export const vaultCreateSalt = async (
  ctx: ServerKoaContext,
  deviceLink: DeviceLink,
  salt: DeviceLinkSalt,
): Promise<void> => {
  const {
    axios: { oauthClient, vaultClient },
  } = ctx;

  const body: CreateEncryptedRecordRequestBody<DeviceLinkSalt> = {
    id: deviceLink.id,
    data: salt,
  };

  await vaultClient.post("/internal/vault", {
    data: body,
    middleware: [
      clientCredentialsMiddleware(oauthClient, [ClientScope.VAULT_ENCRYPTED_RECORD_WRITE]),
    ],
  });
};
