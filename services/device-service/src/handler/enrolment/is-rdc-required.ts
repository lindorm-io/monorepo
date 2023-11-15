import { difference, filter } from "lodash";
import { ServerKoaContext } from "../../types";
import { getDeviceHeaders } from "../get-device-headers";

export const isRdcRequired = async (
  ctx: ServerKoaContext,
  identityId: string,
): Promise<boolean> => {
  const {
    mongo: { deviceLinkRepository },
  } = ctx;

  const deviceLinks = await deviceLinkRepository.findMany({
    active: true,
    identityId,
    trusted: true,
  });

  const { installationId, uniqueId } = getDeviceHeaders(ctx);

  const filtered = filter(deviceLinks, {
    installationId,
    uniqueId,
  });

  const diff = difference(deviceLinks, filtered);

  return diff.length > 0;
};
