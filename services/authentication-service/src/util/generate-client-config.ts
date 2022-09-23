import { AUTHENTICATION_STRATEGY_CONFIG, AuthenticationStrategyConfig } from "../constant";
import { AuthenticationSession } from "../entity";
import { ClientConfig } from "../types";
import { ServerError } from "@lindorm-io/errors";
import { filter, find, orderBy, uniq } from "lodash";

type AdjustedConfig = AuthenticationStrategyConfig & { recommended: boolean; requested: boolean };

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

  const adjustedConfig: Array<AdjustedConfig> = [];

  for (const config of allowedConfig) {
    let recommended = false;
    let requested = false;
    let weight = config.weight;

    if (authenticationSession.requiredLevel === config.value) {
      recommended = true;
      weight = weight * 5;
    }
    if (authenticationSession.recommendedMethods.includes(config.method)) {
      recommended = true;
      weight = weight * 25;
    }
    if (authenticationSession.requiredMethods.includes(config.method)) {
      requested = true;
      weight = weight * 100;
    }

    adjustedConfig.push({ ...config, weight, recommended, requested });
  }

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
      rank,
      recommended: config.recommended,
      requested: config.requested,
      strategies,
    });

    rank += 1;
  }

  return clientConfig;
};
