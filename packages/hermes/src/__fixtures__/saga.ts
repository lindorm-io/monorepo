import { createMockLogger } from "@lindorm/logger";
import { createMockRabbitMessageBus } from "@lindorm/rabbit";
import { randomUUID } from "crypto";
import { HermesCommand, HermesTimeout } from "../messages";
import { SagaIdentifier, SagaOptions } from "../types";

export const TEST_SAGA_IDENTIFIER: SagaIdentifier = {
  id: randomUUID(),
  name: "name",
  context: "default",
};

export const TEST_SAGA_OPTIONS: SagaOptions = {
  ...TEST_SAGA_IDENTIFIER,
  commandBus: createMockRabbitMessageBus(HermesCommand),
  timeoutBus: createMockRabbitMessageBus(HermesTimeout),
  logger: createMockLogger(),
};
