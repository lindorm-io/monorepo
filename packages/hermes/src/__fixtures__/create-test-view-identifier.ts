import { randomUUID } from "crypto";
import { ViewIdentifier } from "../types";
import { createTestRegistry } from "./create-test-registry";
import { TestMongoView } from "./modules/views/TestMongoView";

export const createTestViewIdentifier = (namespace?: string): ViewIdentifier => {
  const view = createTestRegistry(namespace).views.find(
    (v) => v.target === TestMongoView,
  )!;

  return {
    id: randomUUID(),
    name: view.name,
    namespace: view.namespace,
  };
};
