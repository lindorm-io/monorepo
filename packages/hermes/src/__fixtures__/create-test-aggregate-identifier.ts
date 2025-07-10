import { randomUUID } from "crypto";
import { AggregateIdentifier } from "../types";
import { createTestRegistry } from "./create-test-registry";
import { TestAggregate } from "./modules/aggregates/TestAggregate";

export const createTestAggregateIdentifier = (
  namespace?: string,
): AggregateIdentifier => {
  const aggregate = createTestRegistry(namespace).aggregates.find(
    (a) => a.target === TestAggregate,
  )!;

  return {
    id: randomUUID(),
    name: aggregate.name,
    namespace: aggregate.namespace,
  };
};
