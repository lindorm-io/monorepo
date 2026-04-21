import type { Dict } from "@lindorm/types";
import { UpcasterChainError } from "../../errors/index.js";
import type { RegisteredAggregate, RegisteredUpcaster } from "../registry/index.js";

export type UpcastResult = {
  data: Dict;
  version: number;
};

export const applyUpcasters = (
  aggregate: RegisteredAggregate,
  chain: Array<RegisteredUpcaster>,
  data: Dict,
): Dict => {
  const instance = new aggregate.target();
  let currentData = data;

  for (const step of chain) {
    const method = (instance as Record<string, unknown>)[step.method];

    if (typeof method !== "function") {
      throw new UpcasterChainError(
        `Upcaster method "${step.method}" not found on aggregate "${aggregate.name}"`,
      );
    }

    currentData = method.call(instance, currentData) as Dict;
  }

  return currentData;
};
