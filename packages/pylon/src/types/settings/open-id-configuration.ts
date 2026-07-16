import type { OpenIdConfiguration } from "@lindorm/types";

export type PylonOpenIdConfigurationSettings = Omit<OpenIdConfiguration, "issuer">;
