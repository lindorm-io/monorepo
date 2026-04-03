import { Environment } from "@lindorm/types";
import { PylonSocketData } from "../../types";

type Options = {
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
    app: { domain, environment, name, version },
    tokens: {},
  };

  return data as D;
};
