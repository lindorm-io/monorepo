import { LoginSession } from "../entity";
import { configuration } from "../configuration";
import { filter, includes } from "lodash";

export const calculateAllowedOidcProviders = (loginSession: LoginSession): Array<string> => {
  const values = configuration.oidc_providers.map((item) => item.key);

  return filter(values, (item) => !includes(loginSession.amrValues, `oidc_${item}`));
};
