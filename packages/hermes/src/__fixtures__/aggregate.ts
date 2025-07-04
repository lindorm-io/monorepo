import { createMockLogger } from "@lindorm/logger";
import { createMockRabbitMessageBus } from "@lindorm/rabbit";
import { randomUUID } from "crypto";
import { HermesEvent } from "../messages";
import { AggregateIdentifier, AggregateOptions } from "../types";

export const TEST_AGGREGATE_IDENTIFIER: AggregateIdentifier = {
  id: randomUUID(),
  name: "aggregate_name",
  context: "default",
};

export const TEST_AGGREGATE_OPTIONS: AggregateOptions = {
  ...TEST_AGGREGATE_IDENTIFIER,
  eventHandlers: [],
  eventBus: createMockRabbitMessageBus(HermesEvent),
  logger: createMockLogger(),
};
