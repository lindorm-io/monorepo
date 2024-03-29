import { randomUUID } from "crypto";
import { subDays } from "date-fns";
import { find } from "lodash";
import { TEST_AGGREGATE_IDENTIFIER } from "../../fixtures/aggregate.fixture";
import { AggregateIdentifier } from "../../types";
import { createChecksum } from "../../util";
import { MemoryEventStore } from "./MemoryEventStore";
import { IN_MEMORY_EVENT_STORE } from "./in-memory";

describe("MemoryEventStore", () => {
  let identifier: AggregateIdentifier;
  let store: MemoryEventStore;

  beforeAll(async () => {
    store = new MemoryEventStore();
  }, 10000);

  beforeEach(() => {
    identifier = { ...TEST_AGGREGATE_IDENTIFIER, id: randomUUID() };
  });

  test("should find events", async () => {
    const causationId = randomUUID();

    const attributes = {
      ...identifier,
      causation_id: causationId,
      correlation_id: randomUUID(),
      events: [
        {
          id: randomUUID(),
          name: "event_name",
          data: { data: true },
          meta: { meta: true },
          version: 3,
          timestamp: new Date(),
        },
      ],
      expected_events: 3,
      previous_event_id: randomUUID(),
      timestamp: new Date(),
    };

    const checksum = createChecksum(attributes);

    IN_MEMORY_EVENT_STORE.push({ ...attributes, checksum });

    await expect(
      store.find({
        ...identifier,
        causation_id: causationId,
      }),
    ).resolves.toStrictEqual([
      expect.objectContaining({
        id: expect.any(String),
        name: "event_name",
        aggregate: {
          id: identifier.id,
          name: "aggregate_name",
          context: "default",
        },
        causation_id: causationId,
        correlation_id: expect.any(String),
        data: { data: true },
        meta: { meta: true },
        timestamp: expect.any(Date),
        version: 3,
      }),
    ]);
  });

  test("should insert events", async () => {
    const causationId = randomUUID();

    await expect(
      store.insert({
        ...identifier,
        causation_id: causationId,
        checksum: "checksum",
        correlation_id: randomUUID(),
        events: [
          {
            id: randomUUID(),
            name: "event_name",
            data: { stuff: "string" },
            meta: { meta: true },
            version: 3,
            timestamp: new Date(),
          },
        ],
        expected_events: 3,
        previous_event_id: randomUUID(),
        timestamp: new Date(),
      }),
    ).resolves.toBeUndefined();

    expect(find(IN_MEMORY_EVENT_STORE, { ...identifier })).toStrictEqual(
      expect.objectContaining({ causation_id: causationId, checksum: "checksum" }),
    );
  });

  test("should list events", async () => {
    const causationId = randomUUID();

    IN_MEMORY_EVENT_STORE.push({
      ...identifier,
      causation_id: causationId,
      checksum: "checksum",
      correlation_id: randomUUID(),
      events: [
        {
          id: randomUUID(),
          name: "event_name",
          data: { stuff: "string" },
          meta: { meta: true },
          version: 3,
          timestamp: new Date(),
        },
      ],
      expected_events: 3,
      previous_event_id: randomUUID(),
      timestamp: subDays(new Date(), 1),
    });

    await expect(store.listEvents(subDays(new Date(), 2), 100)).resolves.toStrictEqual(
      expect.arrayContaining([
        expect.objectContaining({
          causation_id: causationId,
        }),
      ]),
    );
  });
});
