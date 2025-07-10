import { createMockLogger } from "@lindorm/logger";
import { IMongoSource, MongoSource } from "@lindorm/mongo";
import { randomUUID } from "crypto";
import { Collection } from "mongodb";
import { createTestAggregateIdentifier } from "../../__fixtures__/create-test-aggregate-identifier";
import { CHECKSUM_STORE } from "../../constants/private";
import { IChecksumStore } from "../../interfaces";
import { AggregateIdentifier, ChecksumStoreAttributes } from "../../types";
import { MongoChecksumStore } from "./MongoChecksumStore";

describe("MongoChecksumStore", () => {
  const namespace = "mon_che_sto";
  const logger = createMockLogger();

  let aggregate: AggregateIdentifier;
  let collection: Collection<ChecksumStoreAttributes>;
  let source: IMongoSource;
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
    aggregate = createTestAggregateIdentifier(namespace);
  });

  afterAll(async () => {
    await source.disconnect();
  });

  test("should find checksum", async () => {
    const eventId = randomUUID();

    await collection.insertOne({
      ...aggregate,
      event_id: eventId,
      checksum: "checksum",
      created_at: new Date(),
    });

    await expect(
      store.find({
        ...aggregate,
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
        ...aggregate,
        event_id: eventId,
        checksum: "checksum",
        created_at: new Date(),
      }),
    ).resolves.toBeUndefined();

    expect(await collection.findOne({ ...aggregate })).toEqual(
      expect.objectContaining({ event_id: eventId, checksum: "checksum" }),
    );
  });
});
