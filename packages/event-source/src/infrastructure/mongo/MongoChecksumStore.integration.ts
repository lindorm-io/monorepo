import { createMockLogger } from "@lindorm-io/core-logger";
import { MongoConnection } from "@lindorm-io/mongo";
import { randomUUID } from "crypto";
import { Collection } from "mongodb";
import { CHECKSUM_STORE } from "../../constant";
import { TEST_AGGREGATE_IDENTIFIER } from "../../fixtures/aggregate.fixture";
import { AggregateIdentifier, ChecksumStoreAttributes } from "../../types";
import { MongoChecksumStore } from "./MongoChecksumStore";

describe("MongoChecksumStore", () => {
  const logger = createMockLogger();

  let collection: Collection<ChecksumStoreAttributes>;
  let connection: MongoConnection;
  let identifier: AggregateIdentifier;
  let store: MongoChecksumStore;

  beforeAll(async () => {
    connection = new MongoConnection(
      {
        host: "localhost",
        port: 5004,
        auth: { username: "root", password: "example" },
        authSource: "admin",
        database: "MongoChecksumStore",
      },
      logger,
    );
    await connection.connect();

    collection = connection.database.collection(CHECKSUM_STORE);

    store = new MongoChecksumStore(connection, logger);
  }, 10000);

  beforeEach(() => {
    identifier = { ...TEST_AGGREGATE_IDENTIFIER, id: randomUUID() };
  });

  afterAll(async () => {
    await connection.disconnect();
  });

  test("should find checksum", async () => {
    const eventId = randomUUID();

    await collection.insertOne({
      ...identifier,
      event_id: eventId,
      checksum: "checksum",
      timestamp: new Date(),
    });

    await expect(
      store.find({
        ...identifier,
        event_id: eventId,
      }),
    ).resolves.toStrictEqual(expect.objectContaining({ event_id: eventId, checksum: "checksum" }));
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

    expect(await collection.findOne({ ...identifier })).toStrictEqual(
      expect.objectContaining({ event_id: eventId, checksum: "checksum" }),
    );
  });
});
