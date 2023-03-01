import { ServerKoaContext } from "../../types";
import { clientCredentialsMiddleware } from "../../middleware";
import { GetIdentityDeviceLinksResponse } from "@lindorm-io/common-types";

export const getValidDeviceLinks = async (
  ctx: ServerKoaContext,
  identityId?: string,
): Promise<Array<string>> => {
  const {
    axios: { deviceClient },
  } = ctx;

  if (!identityId) {
    return [];
  }

  try {
    const { data } = await deviceClient.get<GetIdentityDeviceLinksResponse>(
      "/admin/identities/:id/device-links",
      {
        params: { id: identityId },
        middleware: [clientCredentialsMiddleware()],
      },
    );

    return data.deviceLinks;
  } catch (err: any) {
    return [];
  }
};
