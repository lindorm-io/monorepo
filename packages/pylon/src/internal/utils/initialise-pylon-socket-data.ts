import type { Environment } from "@lindorm/types";
import type { AppConfig, PylonSocketData } from "../../types/index.js";

type Options = {
  audit?: { enabled: boolean };
  cache?: { enabled: boolean };
  domain?: string;
  environment?: Environment;
  name?: string;
  rateLimit?: { enabled: boolean };
  version?: string;
};

export const initialisePylonSocketData = <D extends PylonSocketData>(
  options: Options,
): D => {
  const domain = options.domain ?? "unknown";
  const environment = options.environment || "unknown";
  const name = options.name ?? "unknown";
  const version = options.version ?? "0.0.0";

  const config: AppConfig = {
    audit: options.audit?.enabled ?? false,
    cache: options.cache?.enabled ?? false,
    rateLimit: options.rateLimit?.enabled ?? false,
  };

  const data: PylonSocketData = {
    app: { config, domain, environment, name, version },
    tokens: {},
    pylon: {},
  };

  return data as D;
};
