import { AggregateIdentifier, AggregateOptions } from "../types";
import { randomUUID } from "crypto";

export const TEST_AGGREGATE_IDENTIFIER: AggregateIdentifier = {
  id: randomUUID(),
  name: "aggregateName",
  context: "aggregateContext",
};

export const TEST_AGGREGATE_OPTIONS: AggregateOptions = {
  ...TEST_AGGREGATE_IDENTIFIER,
  eventHandlers: [],
};
