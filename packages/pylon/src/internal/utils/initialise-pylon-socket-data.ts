import type { Environment } from "@lindorm/types";
import type { AppConfig, PylonSocketData } from "../../types/index.js";

type Options = {
  /**
   * The deployment's resolved policy, built ONCE by `buildAppConfig` after
   * `amphora.setup()` and shared with the http transport. It is stamped onto
   * every socket's `data.app`, so it must be the same reference rather than a
   * per-connection rebuild of the same inputs.
   */
  config: AppConfig;
  domain?: string;
  environment?: Environment;
  name?: string;
  version?: string;
};

export const initialisePylonSocketData = <D extends PylonSocketData>(
  options: Options,
): D => {
  const domain = options.domain ?? "unknown";
  const environment = options.environment || "unknown";
  const name = options.name ?? "unknown";
  const version = options.version ?? "0.0.0";

  const data: PylonSocketData = {
    app: { config: options.config, domain, environment, name, version },
    tokens: {},
    pylon: {},
  };

  return data as D;
};
