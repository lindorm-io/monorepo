import { OpenIdConfiguration } from "@lindorm/types";

export type OpenIdConfigurationOptions = Omit<OpenIdConfiguration, "issuer">;
