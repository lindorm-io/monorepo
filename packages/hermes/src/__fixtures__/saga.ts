import { createMockLogger } from "@lindorm/logger";
import { randomUUID } from "crypto";
import { SagaIdentifier, SagaOptions } from "../types";

export const TEST_SAGA_IDENTIFIER: SagaIdentifier = {
  id: randomUUID(),
  name: "name",
  context: "default",
};

export const TEST_SAGA_OPTIONS: SagaOptions = {
  ...TEST_SAGA_IDENTIFIER,
  logger: createMockLogger(),
};
