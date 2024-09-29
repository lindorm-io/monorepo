import { createMockLogger } from "@lindorm/logger";
import { ShaKit } from "@lindorm/sha";
import { sortKeys } from "@lindorm/utils";
import { randomUUID } from "crypto";
import { ChecksumError } from "../errors";
import { HermesEvent } from "../messages";
import { ChecksumStore } from "./ChecksumStore";

describe("ChecksumStore", () => {
  const logger = createMockLogger();

  let checksum: string;
  let mock: any;
  let store: ChecksumStore;
  let event: HermesEvent;

  beforeAll(async () => {
    mock = {
      find: jest.fn(),
      insert: jest.fn().mockResolvedValue(undefined),
    };

    store = new ChecksumStore({
      custom: mock,
      logger,
    });
  });

  beforeEach(() => {
    event = new HermesEvent({
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
      meta: { meta: ["data"] },
      name: "name",
      timestamp: new Date(),
      version: 1,
    });

    const kit = new ShaKit({ algorithm: "SHA256", format: "base64" });

    checksum = kit.hash(JSON.stringify(sortKeys(event)));
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
