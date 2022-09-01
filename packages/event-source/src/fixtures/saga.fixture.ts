import { SagaIdentifier, SagaOptions } from "../types";
import { randomUUID } from "crypto";

export const TEST_SAGA_IDENTIFIER: SagaIdentifier = {
  id: randomUUID(),
  name: "name",
  context: "default",
};

export const TEST_SAGA_OPTIONS: SagaOptions = {
  ...TEST_SAGA_IDENTIFIER,
};
