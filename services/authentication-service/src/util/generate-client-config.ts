import { AuthMethodConfig } from "@lindorm-io/common-types";
import { ServerError } from "@lindorm-io/errors";
import { orderBy, uniq } from "lodash";
import { AuthenticationSession } from "../entity";
import { STRATEGY_CONFIG_LIST } from "../strategies";
import { AuthenticationStrategyConfig } from "../types";
import { getConfigHint } from "./get-config-hint";

type AdjustedConfig = AuthenticationStrategyConfig & { recommended: boolean; required: boolean };

export const generateClientConfig = (
  authenticationSession: AuthenticationSession,
): Array<AuthMethodConfig> => {
  if (!authenticationSession.allowedStrategies.length) {
    throw new ServerError("Unexpected Error", {
      description: "AuthenticationSession has no allowed methods",
    });
  }

  const allowedStrategies = STRATEGY_CONFIG_LIST.filter((config) =>
    authenticationSession.allowedStrategies.includes(config.strategy),
  );

  const adjustedStrategies: Array<AdjustedConfig> = [];

  for (const config of allowedStrategies) {
    let recommended = false;
    let required = false;
    let weight = config.weight;

    if (authenticationSession.requiredLevelOfAssurance === config.loa) {
      weight = weight * 5;
    }

    if (authenticationSession.idTokenMethods.includes(config.method)) {
      recommended = true;
      weight = weight * 25;
    }

    if (authenticationSession.requiredMethods.includes(config.method)) {
      required = true;
      weight = weight * 100;
    }

    if (authenticationSession.requiredStrategies.includes(config.strategy)) {
      required = true;
      weight = weight * 100;
    }

    adjustedStrategies.push({ ...config, weight, recommended, required });
  }

  const orderedStrategies = orderBy(
    adjustedStrategies,
    ["weight", "loa", "loaMax", "mfaCookie"],
    ["desc", "desc", "desc", "desc"],
  );

  const orderedMethods = uniq(orderedStrategies.map((config) => config.method));

  const clientConfig: Array<AuthMethodConfig> = [];

  let rank = 1;

  for (const method of orderedMethods) {
    const config = orderedStrategies.find((x) => x.method === method);

    if (!config) continue;

    const strategies = orderedStrategies
      .filter((x) => x.method === method)
      .map((config) => ({
        strategy: config.strategy,
        weight: config.weight,
      }));

    clientConfig.push({
      hint: getConfigHint(authenticationSession, config),
      hintType: config.hintType,
      identifierType: config.identifierType,
      method,
      rank,
      recommended: config.recommended,
      required: config.required,
      strategies,
      weight: config.weight,
    });

    rank += 1;
  }

  return clientConfig;
};
