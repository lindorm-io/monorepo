import { LevelOfAssurance } from "../common";
import { LoginSession } from "../entity";
import { configuration } from "../server/configuration";
import { find } from "lodash";
import { getFlowTypeConfig } from "./get-flow-type-config";

export const calculateLevelOfAssurance = (loginSession: LoginSession): LevelOfAssurance => {
  let value = 0;
  let maxValue = 0;

  for (const name of loginSession.amrValues) {
    const config = getFlowTypeConfig(name);

    if (config) {
      value = value + config.value;
      maxValue = config.valueMax > maxValue ? config.valueMax : maxValue;
    } else {
      const oidc = find(
        configuration.oidc_providers,
        (provider) => provider.key === name.replace("oidc_", ""),
      );

      if (!oidc) continue;

      value = value + oidc.loa_value;
      maxValue = oidc.loa_value > maxValue ? oidc.loa_value : maxValue;
    }
  }

  return (value > maxValue ? maxValue : value) as LevelOfAssurance;
};
