import { AUTHENTICATION_METHOD_CONFIG, AuthenticationMethodConfig } from "../constant";
import { AuthenticationMethod } from "../enum";
import { ServerError } from "@lindorm-io/errors";
import { find } from "lodash";

export const findMethodConfiguration = (
  method: AuthenticationMethod,
): AuthenticationMethodConfig => {
  const config = find(AUTHENTICATION_METHOD_CONFIG, { name: method });

  if (!config) {
    throw new ServerError("Strategy not found");
  }

  return config;
};
