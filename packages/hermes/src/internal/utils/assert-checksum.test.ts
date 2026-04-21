import { assertChecksum } from "./assert-checksum";
import { createChecksum } from "./create-checksum";
import type { EventRecord } from "../entities";
import { describe, expect, test } from "vitest";

describe("assertChecksum", () => {
  const makeRecord = (overrides?: Partial<EventRecord>): EventRecord => {
    const base = {
      id: "event-id-1",
      aggregateId: "agg-1",
      aggregateName: "test_aggregate",
      aggregateNamespace: "default",
      causationId: "cmd-1",
      correlationId: "corr-1",
      data: { input: "hello" },
      encrypted: false,
      name: "test_event_create",
      timestamp: new Date("2024-01-01T00:00:00.000Z"),
      expectedEvents: 1,
      meta: {},
      previousId: null,
      version: 1,
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
      checksum: "",
    };

    const { checksum, createdAt, ...rest } = { ...base, ...overrides };
    const computed = createChecksum(rest);

    return {
      ...rest,
      checksum: overrides?.checksum ?? computed,
      createdAt,
    };
  };

  test("should not throw when checksum matches record", () => {
    const record = makeRecord();

    expect(() => assertChecksum(record)).not.toThrow();
  });

  test("should throw when checksum does not match record", () => {
    const record = makeRecord({ checksum: "wrong-checksum-value" });

    expect(() => assertChecksum(record)).toThrow();
  });

  test("should throw when checksum is missing", () => {
    const record = makeRecord({ checksum: "" });

    expect(() => assertChecksum(record)).toThrow("Missing checksum");
  });
});
