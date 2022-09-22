import { AUTHENTICATION_STRATEGY_CONFIG } from "../constant";
import { AuthenticationSession } from "../entity";
import { ClientConfig } from "../types";
import { ServerError } from "@lindorm-io/errors";
import { filter, find, orderBy, uniq } from "lodash";

export const generateClientConfig = (
  authenticationSession: AuthenticationSession,
): Array<ClientConfig> => {
  if (!authenticationSession.allowedStrategies.length) {
    throw new ServerError("Unexpected Error", {
      description: "AuthenticationSession has no allowed methods",
    });
  }

  const allowedConfig = AUTHENTICATION_STRATEGY_CONFIG.filter((config) =>
    authenticationSession.allowedStrategies.includes(config.strategy),
  );

  const adjustedConfig = allowedConfig.map((config) =>
    authenticationSession.requestedMethods.includes(config.method)
      ? { ...config, weight: config.weight * 100 }
      : config,
  );

  const orderedConfig = orderBy(
    adjustedConfig,
    ["weight", "value", "valueMax", "mfaCookie"],
    ["desc", "desc", "desc", "desc"],
  );

  const orderedMethods = uniq(orderedConfig.map((config) => config.method));

  const clientConfig: Array<ClientConfig> = [];
  let rank = 1;

  for (const method of orderedMethods) {
    const config = find(orderedConfig, { method });
    const strategies = filter(orderedConfig, { method }).map((config) => config.strategy);

    clientConfig.push({
      hint: config.hint,
      initialiseKey: config.initialiseKey,
      method,
      strategies,
      rank,
    });

    rank += 1;
  }

  return clientConfig;
};
