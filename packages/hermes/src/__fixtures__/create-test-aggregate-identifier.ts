import { randomUUID } from "crypto";
import type { AggregateIdentifier } from "../types";

export const createTestAggregateIdentifier = (
  overrides: Partial<AggregateIdentifier> = {},
): AggregateIdentifier => ({
  id: randomUUID(),
  name: "test_aggregate",
  namespace: "hermes",
  ...overrides,
});
