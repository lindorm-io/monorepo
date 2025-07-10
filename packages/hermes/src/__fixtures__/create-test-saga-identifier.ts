import { randomUUID } from "crypto";
import { SagaIdentifier } from "../types";
import { createTestRegistry } from "./create-test-registry";
import { TestSaga } from "./modules/sagas/TestSaga";

export const createTestSagaIdentifier = (namespace?: string): SagaIdentifier => {
  const saga = createTestRegistry(namespace).sagas.find((s) => s.target === TestSaga)!;

  return {
    id: randomUUID(),
    name: saga.name,
    namespace: saga.namespace,
  };
};
