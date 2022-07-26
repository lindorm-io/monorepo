import { EventStore, ViewStore } from "../infrastructure";
import { MongoConnection } from "@lindorm-io/mongo";
import { ReplayDomain } from "./ReplayDomain";
import { createMockLogger } from "@lindorm-io/winston";
import { createMockMessageBus } from "@lindorm-io/amqp";
import { generateTestEventStoreAttributes } from "../fixtures/replay.fixture";

describe("ReplayDomain", () => {
  const logger = createMockLogger();

  let connection: MongoConnection;
  let messageBus: any;
  let eventStore: EventStore;
  let viewStore: ViewStore;
  let domain: ReplayDomain;

  beforeAll(async () => {
    messageBus = createMockMessageBus();
    connection = new MongoConnection({
      host: "localhost",
      port: 27011,
      auth: { username: "root", password: "example" },
      logger,
      database: "db",
    });
    eventStore = new EventStore({
      connection,
      logger,
    });
    viewStore = new ViewStore({
      connection,
      logger,
    });
    domain = new ReplayDomain({
      eventStore,
      messageBus,
      viewStore,
      logger,
      context: "default",
    });

    await domain.subscribe();

    await connection.connect();
    const eventCollection = connection.client.db("db").collection("events");

    const aggregates = generateTestEventStoreAttributes(250);
    await eventCollection.insertMany(aggregates);

    await connection.client.db("db").createCollection("views_default_one");
    await connection.client.db("db").createCollection("views_default_two");
    await connection.client.db("db").createCollection("views_default_three");
    await connection.client.db("db").createCollection("views_default_four");
  }, 30000);

  test("should resolve", async () => {}, 15000);
});
