import { ENABLED_STRATEGIES } from "./enabled-strategies";

export const STRATEGY_CONFIG_LIST = ENABLED_STRATEGIES.map((strategy) => strategy.config());
