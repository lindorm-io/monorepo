import { randomUUID } from "crypto";
import type { AggregateIdentifier } from "../types/index.js";

export const createTestAggregateIdentifier = (
  overrides: Partial<AggregateIdentifier> = {},
): AggregateIdentifier => ({
  id: randomUUID(),
  name: "test_aggregate",
  namespace: "hermes",
  ...overrides,
});
