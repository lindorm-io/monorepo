import { sortObjectKeys } from "@lindorm-io/core";
import { createMockLogger } from "@lindorm-io/core-logger";
import { createShaHash } from "@lindorm-io/crypto";
import { randomUUID } from "crypto";
import { ChecksumStoreType } from "../enum";
import { ChecksumError } from "../error";
import { DomainEvent } from "../message";
import { ChecksumStore } from "./ChecksumStore";

describe("ChecksumStore", () => {
  const logger = createMockLogger();

  let checksum: string;
  let mock: any;
  let store: ChecksumStore;
  let event: DomainEvent;

  beforeAll(async () => {
    mock = {
      find: jest.fn(),
      insert: jest.fn().mockResolvedValue(undefined),
    };

    store = new ChecksumStore(
      {
        type: ChecksumStoreType.CUSTOM,
        custom: mock,
      },
      logger,
    );
  });

  beforeEach(() => {
    event = new DomainEvent({
      id: randomUUID(),
      aggregate: {
        id: randomUUID(),
        name: "name",
        context: "context",
      },
      causationId: randomUUID(),
      correlationId: randomUUID(),
      data: { foo: "bar", bar: "baz", baz: 1, random: randomUUID() },
      delay: 0,
      mandatory: true,
      metadata: { meta: ["data"] },
      name: "name",
      timestamp: new Date(),
      version: 1,
    });

    checksum = createShaHash({
      algorithm: "SHA256",
      data: JSON.stringify(sortObjectKeys(event)),
      format: "base64",
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("should verify checksum with new event", async () => {
    await expect(store.verify(event)).resolves.toBeUndefined();

    expect(mock.insert).toHaveBeenCalledWith({
      id: event.aggregate.id,
      name: event.aggregate.name,
      context: event.aggregate.context,
      event_id: event.id,
      checksum,
      timestamp: event.timestamp,
    });
  });

  test("should verify checksum with existing event", async () => {
    mock.find.mockResolvedValue({
      id: event.aggregate.id,
      name: event.aggregate.name,
      context: event.aggregate.context,
      event_id: event.id,
      checksum,
      timestamp: event.timestamp,
    });

    await expect(store.verify(event)).resolves.toBeUndefined();

    expect(mock.insert).not.toHaveBeenCalled();
  });

  test("should throw on checksum mismatch", async () => {
    mock.find.mockResolvedValue({
      id: event.aggregate.id,
      name: event.aggregate.name,
      context: event.aggregate.context,
      event_id: event.id,
      checksum: "invalid",
      timestamp: event.timestamp,
    });

    await expect(store.verify(event)).rejects.toThrow(ChecksumError);
  });
});
