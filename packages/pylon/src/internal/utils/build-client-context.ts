import { parseClientHeaders, parseUserAgent } from "@lindorm/utils";
import type { PylonClientContext } from "../../types/index.js";

export const buildClientContext = (
  userAgentRaw: string | null,
  getHeader: (name: string) => string | undefined,
): PylonClientContext => {
  const parsed = parseUserAgent(userAgentRaw);
  const declared = parseClientHeaders(getHeader);

  return {
    userAgent: {
      ...parsed,
      // Client-declared device type wins over the heuristic UA parse.
      deviceType: declared.deviceType ?? parsed.deviceType,
    },
    // Surface app whenever either the name or version is declared. A bare
    // version with no name falls back to "unknown" so it is not silently lost.
    app:
      declared.app || declared.appVersion
        ? { name: declared.app ?? "unknown", version: declared.appVersion }
        : null,
    build: declared.build,
    channel: declared.channel,
    device:
      declared.deviceName || declared.deviceModel
        ? { name: declared.deviceName, model: declared.deviceModel }
        : null,
    platform: declared.platform,
    timezone: declared.timezone,
  };
};
