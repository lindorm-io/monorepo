import { createMockLogger } from "@lindorm/logger";
import { IMongoSource, MongoSource } from "@lindorm/mongo";
import { randomUUID } from "crypto";
import { Collection } from "mongodb";
import { TEST_AGGREGATE_IDENTIFIER } from "../../__fixtures__/aggregate";
import { CHECKSUM_STORE } from "../../constants/private";
import { IChecksumStore } from "../../interfaces";
import { AggregateIdentifier, ChecksumStoreAttributes } from "../../types";
import { MongoChecksumStore } from "./MongoChecksumStore";

describe("MongoChecksumStore", () => {
  const logger = createMockLogger();

  let collection: Collection<ChecksumStoreAttributes>;
  let source: IMongoSource;
  let identifier: AggregateIdentifier;
  let store: IChecksumStore;

  beforeAll(async () => {
    source = new MongoSource({
      database: "MongoChecksumStore",
      logger,
      url: "mongodb://root:example@localhost/admin?authSource=admin",
    });

    await source.setup();

    collection = source.collection(CHECKSUM_STORE);

    store = new MongoChecksumStore(source, logger);
  }, 10000);

  beforeEach(() => {
    identifier = { ...TEST_AGGREGATE_IDENTIFIER, id: randomUUID() };
  });

  afterAll(async () => {
    await source.disconnect();
  });

  test("should find checksum", async () => {
    const eventId = randomUUID();

    await collection.insertOne({
      ...identifier,
      event_id: eventId,
      checksum: "checksum",
      created_at: new Date(),
    });

    await expect(
      store.find({
        ...identifier,
        event_id: eventId,
      }),
    ).resolves.toEqual(
      expect.objectContaining({ event_id: eventId, checksum: "checksum" }),
    );
  });

  test("should insert checksum", async () => {
    const eventId = randomUUID();

    await expect(
      store.insert({
        ...identifier,
        event_id: eventId,
        checksum: "checksum",
        created_at: new Date(),
      }),
    ).resolves.toBeUndefined();

    expect(await collection.findOne({ ...identifier })).toEqual(
      expect.objectContaining({ event_id: eventId, checksum: "checksum" }),
    );
  });
});
