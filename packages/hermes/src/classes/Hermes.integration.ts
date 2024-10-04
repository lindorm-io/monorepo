import { createMockLogger } from "@lindorm/logger";
import { IMongoSource, MongoSource } from "@lindorm/mongo";
import { IPostgresSource, PostgresSource } from "@lindorm/postgres";
import { IRabbitSource, RabbitSource } from "@lindorm/rabbit";
import { IRedisSource, RedisSource } from "@lindorm/redis";
import { randomUUID } from "crypto";
import { z } from "zod";
import { ViewStoreType } from "../enums";
import {
  HermesAggregateCommandHandler,
  HermesAggregateEventHandler,
  HermesChecksumEventHandler,
  HermesQueryHandler,
  HermesSagaEventHandler,
  HermesViewEventHandler,
} from "../handlers";
import { IHermes } from "../interfaces";
import { HermesEvent } from "../messages";
import { Hermes } from "./Hermes";

export class CreateGreeting {
  public constructor(public readonly create: boolean) {}
}
export class GreetingCreated {
  public constructor(public readonly created: boolean) {}
}

export class UpdateGreeting {
  public constructor(public readonly update: boolean) {}
}
export class GreetingUpdated {
  public constructor(public readonly updated: boolean) {}
}

export class QueryGreetingMongo {
  public constructor(public readonly id: string) {}
}
export class QueryGreetingPostgres {
  public constructor(public readonly id: string) {}
}
export class QueryGreetingRedis {
  public constructor(public readonly id: string) {}
}

describe("Hermes", () => {
  const logger = createMockLogger();

  let mongo: IMongoSource;
  let postgres: IPostgresSource;
  let rabbit: IRabbitSource;
  let redis: IRedisSource;
  let hermes: IHermes;

  let onEventSpyAll: jest.Mock;
  let onEventSpyContext: jest.Mock;
  let onEventSpyName: jest.Mock;
  let onEventSpyId: jest.Mock;

  beforeAll(async () => {
    mongo = new MongoSource({
      database: "Hermes",
      logger,
      url: "mongodb://root:example@localhost/admin?authSource=admin",
    });

    postgres = new PostgresSource({
      logger,
      url: "postgres://root:example@localhost:5432/default",
    });

    rabbit = new RabbitSource({
      logger,
      url: "amqp://localhost:5672",
    });

    redis = new RedisSource({
      logger,
      url: "redis://localhost:6379",
    });

    await Promise.all([mongo.setup(), postgres.setup(), rabbit.setup(), redis.setup()]);

    hermes = new Hermes({
      checksumStore: { mongo },
      encryptionStore: { mongo },
      eventStore: { mongo },
      messageBus: { rabbit },
      sagaStore: { mongo },
      viewStore: { mongo, postgres, redis },
      context: "hermes",
      dangerouslyRegisterHandlersManually: true,
      logger,
    });

    onEventSpyAll = jest.fn();
    onEventSpyContext = jest.fn();
    onEventSpyName = jest.fn();
    onEventSpyId = jest.fn();

    await hermes.admin.register.aggregateCommandHandler(
      new HermesAggregateCommandHandler<CreateGreeting, GreetingCreated>({
        commandName: "create_greeting",
        aggregate: { name: "test_aggregate", context: "hermes" },
        conditions: { created: false },
        schema: z.object({
          create: z.boolean(),
        }),
        handler: async (ctx) => {
          await ctx.apply(new GreetingCreated(ctx.command.create));
        },
      }),
    );
    await hermes.admin.register.aggregateCommandHandler(
      new HermesAggregateCommandHandler<UpdateGreeting, GreetingUpdated>({
        commandName: "update_greeting",
        aggregate: { name: "test_aggregate", context: "hermes" },
        conditions: { created: true },
        schema: z.object({
          update: z.boolean(),
        }),
        handler: async (ctx) => {
          await ctx.apply(new GreetingUpdated(ctx.command.update));
        },
      }),
    );

    await hermes.admin.register.aggregateEventHandler(
      new HermesAggregateEventHandler<GreetingCreated>({
        eventName: "greeting_created",
        aggregate: { name: "test_aggregate", context: "hermes" },
        handler: async (ctx) => {
          ctx.mergeState(ctx.event);
        },
      }),
    );
    await hermes.admin.register.aggregateEventHandler(
      new HermesAggregateEventHandler<GreetingUpdated>({
        eventName: "greeting_updated",
        aggregate: { name: "test_aggregate", context: "hermes" },
        handler: async (ctx) => {
          ctx.mergeState(ctx.event);
        },
      }),
    );

    await hermes.admin.register.checksumEventHandler(
      new HermesChecksumEventHandler({
        eventName: "greeting_created",
        aggregate: { name: "test_aggregate", context: "hermes" },
      }),
    );
    await hermes.admin.register.checksumEventHandler(
      new HermesChecksumEventHandler({
        eventName: "greeting_updated",
        aggregate: { name: "test_aggregate", context: "hermes" },
      }),
    );

    hermes.admin.register.queryHandler(
      new HermesQueryHandler<QueryGreetingMongo, unknown>({
        queryName: "query_greeting_mongo",
        view: { name: "test_view_mongo", context: "hermes" },
        handler: (ctx) => ctx.repositories.mongo.findById(ctx.query.id),
      }),
    );

    hermes.admin.register.queryHandler(
      new HermesQueryHandler<QueryGreetingPostgres, unknown>({
        queryName: "query_greeting_postgres",
        view: { name: "test_view_postgres", context: "hermes" },
        handler: (ctx) => ctx.repositories.postgres.findById(ctx.query.id),
      }),
    );

    hermes.admin.register.queryHandler(
      new HermesQueryHandler<QueryGreetingRedis, unknown>({
        queryName: "query_greeting_redis",
        view: { name: "test_view_redis", context: "hermes" },
        handler: (ctx) => ctx.repositories.redis.findById(ctx.query.id),
      }),
    );

    await hermes.admin.register.sagaEventHandler(
      new HermesSagaEventHandler<GreetingCreated>({
        eventName: "greeting_created",
        aggregate: { name: "test_aggregate", context: "hermes" },
        saga: { name: "test_saga", context: "hermes" },
        conditions: { created: false },
        getSagaId: (event) => event.aggregate.id,
        handler: async (ctx) => {
          ctx.mergeState(ctx.event);
          ctx.logger.info("GreetingCreatedEvent", { event: ctx.event });

          ctx.dispatch(new UpdateGreeting(true), { delay: 500 });
        },
      }),
    );
    await hermes.admin.register.sagaEventHandler(
      new HermesSagaEventHandler<GreetingUpdated>({
        eventName: "greeting_updated",
        aggregate: { name: "test_aggregate", context: "hermes" },
        saga: { name: "test_saga", context: "hermes" },
        conditions: { created: true },
        getSagaId: (event) => event.aggregate.id,
        handler: async (ctx) => {
          ctx.mergeState(ctx.event);
          ctx.logger.info("GreetingUpdatedEvent", { event: ctx.event });
        },
      }),
    );

    await hermes.admin.register.viewEventHandler(
      new HermesViewEventHandler<GreetingCreated>({
        eventName: "greeting_created",
        adapter: { type: ViewStoreType.Mongo },
        aggregate: { name: "test_aggregate", context: "hermes" },
        conditions: { created: false },
        view: { name: "test_view_mongo", context: "hermes" },
        getViewId: (event) => event.aggregate.id,
        handler: async (ctx) => {
          ctx.setState({ created: ctx.event.created });
        },
      }),
    );
    await hermes.admin.register.viewEventHandler(
      new HermesViewEventHandler<GreetingUpdated>({
        eventName: "greeting_updated",
        adapter: { type: ViewStoreType.Mongo },
        aggregate: { name: "test_aggregate", context: "hermes" },
        conditions: { created: true },
        view: { name: "test_view_mongo", context: "hermes" },
        getViewId: (event) => event.aggregate.id,
        handler: async (ctx) => {
          ctx.mergeState({ updated: ctx.event.updated });
        },
      }),
    );

    await hermes.admin.register.viewEventHandler(
      new HermesViewEventHandler<GreetingCreated>({
        eventName: "greeting_created",
        adapter: { type: ViewStoreType.Postgres },
        aggregate: { name: "test_aggregate", context: "hermes" },
        conditions: { created: false },
        view: { name: "test_view_postgres", context: "hermes" },
        getViewId: (event) => event.aggregate.id,
        handler: async (ctx) => {
          ctx.setState({ created: ctx.event.created });
        },
      }),
    );
    await hermes.admin.register.viewEventHandler(
      new HermesViewEventHandler<GreetingUpdated>({
        eventName: "greeting_updated",
        adapter: { type: ViewStoreType.Postgres },
        aggregate: { name: "test_aggregate", context: "hermes" },
        conditions: { created: true },
        view: { name: "test_view_postgres", context: "hermes" },
        getViewId: (event) => event.aggregate.id,
        handler: async (ctx) => {
          ctx.mergeState({ updated: ctx.event.updated });
        },
      }),
    );

    await hermes.admin.register.viewEventHandler(
      new HermesViewEventHandler<GreetingCreated>({
        eventName: "greeting_created",
        adapter: { type: ViewStoreType.Redis },
        aggregate: { name: "test_aggregate", context: "hermes" },
        conditions: { created: false },
        view: { name: "test_view_redis", context: "hermes" },
        getViewId: (event) => event.aggregate.id,
        handler: async (ctx) => {
          ctx.setState({ created: ctx.event.created });
        },
      }),
    );
    await hermes.admin.register.viewEventHandler(
      new HermesViewEventHandler<GreetingUpdated>({
        eventName: "greeting_updated",
        adapter: { type: ViewStoreType.Redis },
        aggregate: { name: "test_aggregate", context: "hermes" },
        conditions: { created: true },
        view: { name: "test_view_redis", context: "hermes" },
        getViewId: (event) => event.aggregate.id,
        handler: async (ctx) => {
          ctx.mergeState({ updated: ctx.event.updated });
        },
      }),
    );

    hermes.admin.register.commandAggregate("create_greeting", "test_aggregate");
    hermes.admin.register.commandAggregate("update_greeting", "test_aggregate");
    hermes.admin.register.viewAdapter({
      name: "test_view_mongo",
      context: "hermes",
      type: ViewStoreType.Mongo,
    });
    hermes.admin.register.viewAdapter({
      name: "test_view_postgres",
      context: "hermes",
      type: ViewStoreType.Postgres,
    });
    hermes.admin.register.viewAdapter({
      name: "test_view_redis",
      context: "hermes",
      type: ViewStoreType.Redis,
    });

    await hermes.setup();
  }, 30000);

  afterAll(async () => {
    await Promise.all([
      mongo.disconnect(),
      postgres.disconnect(),
      rabbit.disconnect(),
      redis.disconnect(),
    ]);
  });

  test("should publish", async () => {
    const id = randomUUID();

    let viewChangeCount = 0;
    hermes.on("view", () => {
      onEventSpyAll();
      viewChangeCount += 1;
    });
    hermes.on("view.hermes", onEventSpyContext);
    hermes.on("view.hermes.test_view_mongo", onEventSpyName);
    hermes.on(`view.hermes.test_view_mongo.${id}`, onEventSpyId);

    await hermes.command(new CreateGreeting(true), { aggregate: { id } });

    await new Promise((resolve) => {
      const interval = setInterval(() => {
        if (viewChangeCount >= 6) {
          clearInterval(interval);
          resolve(undefined);
        }
      }, 50);
    });

    await expect(
      hermes.admin.inspect.aggregate({ id, name: "test_aggregate" }),
    ).resolves.toEqual(
      expect.objectContaining({
        id,
        name: "test_aggregate",
        context: "hermes",
        destroyed: false,
        events: [expect.any(HermesEvent), expect.any(HermesEvent)],
        numberOfLoadedEvents: 2,
        state: {
          created: true,
          updated: true,
        },
      }),
    );

    await expect(hermes.admin.inspect.saga({ id, name: "test_saga" })).resolves.toEqual(
      expect.objectContaining({
        id: id,
        name: "test_saga",
        context: "hermes",
        processedCausationIds: [],
        destroyed: false,
        messagesToDispatch: [],
        revision: 5,
        state: {
          created: true,
          updated: true,
        },
      }),
    );

    await expect(
      hermes.admin.inspect.view({ id, name: "test_view_mongo" }),
    ).resolves.toEqual(
      expect.objectContaining({
        id,
        name: "test_view_mongo",
        context: "hermes",
        destroyed: false,
        hash: expect.any(String),
        meta: {
          created: {
            destroyed: false,
            timestamp: expect.any(Date),
            value: true,
          },
          updated: {
            destroyed: false,
            timestamp: expect.any(Date),
            value: true,
          },
        },
        processedCausationIds: [expect.any(String), expect.any(String)],
        revision: 2,
        state: {
          created: true,
          updated: true,
        },
      }),
    );

    await expect(
      hermes.admin.inspect.view({ id, name: "test_view_postgres" }),
    ).resolves.toEqual(
      expect.objectContaining({
        id,
        name: "test_view_postgres",
        context: "hermes",
        destroyed: false,
        hash: expect.any(String),
        meta: {
          created: {
            destroyed: false,
            timestamp: expect.any(Date),
            value: true,
          },
          updated: {
            destroyed: false,
            timestamp: expect.any(Date),
            value: true,
          },
        },
        processedCausationIds: [expect.any(String), expect.any(String)],
        revision: 2,
        state: {
          created: true,
          updated: true,
        },
      }),
    );

    await expect(
      hermes.admin.inspect.view({ id, name: "test_view_redis" }),
    ).resolves.toEqual(
      expect.objectContaining({
        id,
        name: "test_view_redis",
        context: "hermes",
        destroyed: false,
        hash: expect.any(String),
        meta: {
          created: {
            destroyed: false,
            timestamp: expect.any(Date),
            value: true,
          },
          updated: {
            destroyed: false,
            timestamp: expect.any(Date),
            value: true,
          },
        },
        processedCausationIds: [expect.any(String), expect.any(String)],
        revision: 2,
        state: {
          created: true,
          updated: true,
        },
      }),
    );

    await expect(hermes.query(new QueryGreetingMongo(id))).resolves.toEqual({
      id,
      state: {
        created: true,
        updated: true,
      },
      created_at: expect.any(Date),
      updated_at: expect.any(Date),
    });

    await expect(hermes.query(new QueryGreetingPostgres(id))).resolves.toEqual({
      id,
      state: {
        created: true,
        updated: true,
      },
      created_at: expect.any(Date),
      updated_at: expect.any(Date),
    });

    await expect(hermes.query(new QueryGreetingRedis(id))).resolves.toEqual({
      id,
      state: {
        created: true,
        updated: true,
      },
      created_at: expect.any(Date),
      updated_at: expect.any(Date),
    });

    expect(onEventSpyAll).toHaveBeenCalledTimes(6);
    expect(onEventSpyContext).toHaveBeenCalledTimes(6);
    expect(onEventSpyName).toHaveBeenCalledTimes(2);
    expect(onEventSpyId).toHaveBeenCalledTimes(2);
  }, 30000);
});
