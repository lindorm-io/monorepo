import { DeviceLink } from "../../../entity";
import { DeviceLinkSalt, ServerKoaContext } from "../../../types";
import { GetEncryptedRecordResponse } from "@lindorm-io/common-types";
import { clientCredentialsMiddleware } from "../../../middleware";

export const vaultGetSalt = async (
  ctx: ServerKoaContext,
  deviceLink: DeviceLink,
): Promise<DeviceLinkSalt> => {
  const {
    axios: { vaultClient },
  } = ctx;

  const response = await vaultClient.get<GetEncryptedRecordResponse<DeviceLinkSalt>>(
    "/admin/vault/:id",
    {
      params: {
        id: deviceLink.id,
      },
      middleware: [clientCredentialsMiddleware()],
    },
  );

  return response.data.data;
};
