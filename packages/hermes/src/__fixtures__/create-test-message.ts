import type { Dict } from "@lindorm/types";
import { randomUUID } from "crypto";
import type { AggregateIdentifier } from "../types/index.js";
import { createTestAggregateIdentifier } from "./create-test-aggregate-identifier.js";

type TestCommandMessageOptions = {
  id?: string;
  aggregate?: Partial<AggregateIdentifier>;
  name?: string;
  version?: number;
  causationId?: string;
  correlationId?: string | null;
  data?: Dict;
  meta?: Dict;
  timestamp?: Date;
};

type TestEventMessageOptions = TestCommandMessageOptions;

type TestTimeoutMessageOptions = TestCommandMessageOptions;

type TestErrorMessageOptions = TestCommandMessageOptions;

export const createTestCommandMessage = (options: TestCommandMessageOptions = {}) => {
  const id = options.id ?? randomUUID();

  return {
    id,
    mandatory: true,
    aggregate: {
      ...createTestAggregateIdentifier(),
      ...options.aggregate,
    },
    name: options.name ?? "test_command_create",
    version: options.version ?? 1,
    causationId: options.causationId ?? id,
    correlationId: options.correlationId ?? null,
    data: options.data ?? { input: "test" },
    meta: options.meta ?? { origin: "test" },
    timestamp: options.timestamp ?? new Date(),
  };
};

export const createTestEventMessage = (options: TestEventMessageOptions = {}) => {
  const id = options.id ?? randomUUID();

  return {
    id,
    mandatory: false,
    aggregate: {
      ...createTestAggregateIdentifier(),
      ...options.aggregate,
    },
    name: options.name ?? "test_event_create",
    version: options.version ?? 1,
    causationId: options.causationId ?? id,
    correlationId: options.correlationId ?? null,
    data: options.data ?? { input: "test" },
    meta: options.meta ?? { origin: "test" },
    timestamp: options.timestamp ?? new Date(),
  };
};

export const createTestTimeoutMessage = (options: TestTimeoutMessageOptions = {}) => {
  const id = options.id ?? randomUUID();

  return {
    id,
    mandatory: true,
    aggregate: {
      ...createTestAggregateIdentifier(),
      ...options.aggregate,
    },
    name: options.name ?? "test_timeout_reminder",
    version: options.version ?? 1,
    causationId: options.causationId ?? id,
    correlationId: options.correlationId ?? null,
    data: options.data ?? { data: "test" },
    meta: options.meta ?? { origin: "test" },
    timestamp: options.timestamp ?? new Date(),
  };
};

export const createTestErrorMessage = (options: TestErrorMessageOptions = {}) => {
  const id = options.id ?? randomUUID();

  return {
    id,
    mandatory: false,
    aggregate: {
      ...createTestAggregateIdentifier(),
      ...options.aggregate,
    },
    name: options.name ?? "DomainError",
    version: options.version ?? 1,
    causationId: options.causationId ?? id,
    correlationId: options.correlationId ?? null,
    data: options.data ?? { message: "test error" },
    meta: options.meta ?? { origin: "test" },
    timestamp: options.timestamp ?? new Date(),
  };
};
