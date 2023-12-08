import { randomUUID } from "crypto";
import { find } from "lodash";
import { TEST_AGGREGATE_IDENTIFIER } from "../../fixtures/aggregate.fixture";
import { AggregateIdentifier } from "../../types";
import { MemoryChecksumStore } from "./MemoryChecksumStore";
import { IN_MEMORY_CHECKSUM_STORE } from "./in-memory";

describe("MemoryChecksumStore", () => {
  let identifier: AggregateIdentifier;
  let store: MemoryChecksumStore;

  beforeAll(async () => {
    store = new MemoryChecksumStore();
  });

  beforeEach(() => {
    identifier = { ...TEST_AGGREGATE_IDENTIFIER, id: randomUUID() };
  });

  test("should find checksum", async () => {
    const attributes = {
      ...identifier,
      event_id: randomUUID(),
      checksum: "checksum",
      timestamp: new Date(),
    };

    IN_MEMORY_CHECKSUM_STORE.push(attributes);

    await expect(
      store.find({
        ...identifier,
        event_id: attributes.event_id,
      }),
    ).resolves.toStrictEqual(attributes);
  });

  test("should insert checksum", async () => {
    const eventId = randomUUID();

    await expect(
      store.insert({
        ...identifier,
        event_id: eventId,
        checksum: "checksum",
        timestamp: new Date(),
      }),
    ).resolves.toBeUndefined();

    expect(find(IN_MEMORY_CHECKSUM_STORE, { ...identifier })).toStrictEqual(
      expect.objectContaining({ event_id: eventId, checksum: "checksum" }),
    );
  });
});
