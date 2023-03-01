import { AuthMethodConfig } from "@lindorm-io/common-types";
import { AuthenticationSession } from "../entity";
import { AuthenticationStrategyConfig } from "../types";
import { STRATEGY_CONFIG_LIST } from "../strategies";
import { ServerError } from "@lindorm-io/errors";
import { filter, find, orderBy, uniq } from "lodash";

type AdjustedConfig = AuthenticationStrategyConfig & { recommended: boolean; required: boolean };

export const generateClientConfig = (
  authenticationSession: AuthenticationSession,
): Array<AuthMethodConfig> => {
  if (!authenticationSession.allowedStrategies.length) {
    throw new ServerError("Unexpected Error", {
      description: "AuthenticationSession has no allowed methods",
    });
  }

  const allowedConfig = STRATEGY_CONFIG_LIST.filter((config) =>
    authenticationSession.allowedStrategies.includes(config.strategy),
  );

  const adjustedConfig: Array<AdjustedConfig> = [];

  for (const config of allowedConfig) {
    let recommended = false;
    let required = false;
    let weight = config.weight;

    if (authenticationSession.requiredLevel === config.loa) {
      weight = weight * 5;
    }
    if (authenticationSession.recommendedMethods.includes(config.method)) {
      recommended = true;
      weight = weight * 25;
    }
    if (authenticationSession.requiredMethods.includes(config.method)) {
      required = true;
      weight = weight * 100;
    }

    adjustedConfig.push({ ...config, weight, recommended, required });
  }

  const orderedConfig = orderBy(
    adjustedConfig,
    ["weight", "value", "valueMax", "mfaCookie"],
    ["desc", "desc", "desc", "desc"],
  );

  const orderedMethods = uniq(orderedConfig.map((config) => config.method));

  const clientConfig: Array<AuthMethodConfig> = [];
  let rank = 1;

  for (const method of orderedMethods) {
    const config = find(orderedConfig, { method });
    if (!config) continue;

    const strategies = filter(orderedConfig, { method }).map((config) => config.strategy);

    clientConfig.push({
      identifierHint: config.identifierHint,
      identifierType: config.identifierType,
      method,
      rank,
      recommended: config.recommended,
      required: config.required,
      strategies,
    });

    rank += 1;
  }

  return clientConfig;
};
