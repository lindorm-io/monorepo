import { ClientScopes } from "../../../common";
import { DeviceLink } from "../../../entity";
import { DeviceLinkSalt, ServerKoaContext } from "../../../types";
import { GetEncryptedRecordResponse } from "@lindorm-io/common-types";
import { clientCredentialsMiddleware } from "../../../middleware";

export const vaultGetSalt = async (
  ctx: ServerKoaContext,
  deviceLink: DeviceLink,
): Promise<DeviceLinkSalt> => {
  const {
    axios: { oauthClient, vaultClient },
  } = ctx;

  const response = await vaultClient.get<GetEncryptedRecordResponse<DeviceLinkSalt>>(
    "/internal/vault/:id",
    {
      params: {
        id: deviceLink.id,
      },
      middleware: [
        clientCredentialsMiddleware(oauthClient, [ClientScopes.VAULT_ENCRYPTED_RECORD_READ]),
      ],
    },
  );

  return response.data.data;
};
