import { SagaIdentifier, SagaOptions } from "../types";
import { randomUUID } from "crypto";

export const TEST_SAGA_IDENTIFIER: SagaIdentifier = {
  id: randomUUID(),
  name: "sagaName",
  context: "sagaContext",
};

export const TEST_SAGA_OPTIONS: SagaOptions = {
  ...TEST_SAGA_IDENTIFIER,
};
