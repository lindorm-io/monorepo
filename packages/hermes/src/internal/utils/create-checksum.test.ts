import { createChecksum } from "./create-checksum.js";
import { describe, expect, test } from "vitest";

describe("createChecksum", () => {
  test("should produce a deterministic base64 SHA256 checksum from event record attributes", () => {
    const input = {
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
    };

    const checksum = createChecksum(input);

    expect(checksum).toMatchSnapshot();

    // Deterministic: same input produces same output
    expect(createChecksum(input)).toBe(checksum);
  });

  test("should produce different checksums for different data", () => {
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
    };

    const modified = { ...base, data: { input: "world" } };

    expect(createChecksum(base)).not.toBe(createChecksum(modified));
  });

  test("should produce same checksum regardless of property insertion order", () => {
    const inputA = {
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
    };

    // Same data, different property insertion order
    const inputB = {
      version: 1,
      previousId: null,
      meta: {},
      expectedEvents: 1,
      timestamp: new Date("2024-01-01T00:00:00.000Z"),
      name: "test_event_create",
      encrypted: false,
      data: { input: "hello" },
      correlationId: "corr-1",
      causationId: "cmd-1",
      aggregateNamespace: "default",
      aggregateName: "test_aggregate",
      aggregateId: "agg-1",
      id: "event-id-1",
    };

    expect(createChecksum(inputA)).toBe(createChecksum(inputB));
  });
});
