import { ServerKoaContext } from "../../types";
import { difference, filter } from "lodash";

export const isRdcRequired = async (
  ctx: ServerKoaContext,
  identityId: string,
): Promise<boolean> => {
  const {
    metadata: {
      device: { installationId, uniqueId },
    },
    repository: { deviceLinkRepository },
  } = ctx;

  const deviceLinks = await deviceLinkRepository.findMany({
    active: true,
    identityId,
    trusted: true,
  });

  const filtered = filter(deviceLinks, {
    installationId,
    uniqueId,
  });

  const diff = difference(deviceLinks, filtered);

  return diff.length > 0;
};
