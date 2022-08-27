import Joi from "joi";
import { AmqpConnection } from "@lindorm-io/amqp";
import { DomainEvent } from "../message";
import { EventSource } from "./EventSource";
import { EventStoreType, MessageBusType, SagaStoreType, ViewStoreType } from "../enum";
import { PostgresConnection } from "@lindorm-io/postgres";
import { createMockLogger } from "@lindorm-io/winston";
import { createTypeormViewEntity } from "../util";
import { randomUUID } from "crypto";
import {
  EventEntity,
  SagaCausationEntity,
  SagaEntity,
  ViewCausationEntity,
} from "../infrastructure";
import {
  AggregateCommandHandlerImplementation,
  AggregateEventHandlerImplementation,
  QueryHandlerImplementation,
  SagaEventHandlerImplementation,
  ViewEventHandlerImplementation,
} from "../handler";

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

export class QueryGreeting {
  public constructor(public readonly id: string) {}
}

describe("EventSource (Postgres)", () => {
  const logger = createMockLogger();
  const ViewEntity = createTypeormViewEntity("test_view", "es_postgres");

  let amqp: AmqpConnection;
  let app: EventSource;
  let postgres: PostgresConnection;

  let onEventSpyAll: jest.Mock;
  let onEventSpyContext: jest.Mock;
  let onEventSpyName: jest.Mock;
  let onEventSpyId: jest.Mock;

  beforeAll(async () => {
    amqp = new AmqpConnection(
      {
        hostname: "localhost",
        port: 5671,
        connectInterval: 500,
        connectTimeout: 30000,
      },
      logger,
    );

    postgres = new PostgresConnection(
      {
        host: "localhost",
        port: 5432,
        username: "root",
        password: "example",
        database: "default_db",
        entities: [EventEntity, SagaEntity, SagaCausationEntity, ViewEntity, ViewCausationEntity],
        synchronize: true,
      },
      logger,
    );

    app = new EventSource(
      {
        adapters: {
          eventStore: EventStoreType.POSTGRES,
          messageBus: MessageBusType.AMQP,
          sagaStore: SagaStoreType.POSTGRES,
          viewStore: ViewStoreType.POSTGRES,
        },
        connections: {
          amqp,
          postgres,
        },
        context: "es_postgres",
        dangerouslyRegisterHandlersManually: true,
      },
      logger,
    );

    onEventSpyAll = jest.fn();
    onEventSpyContext = jest.fn();
    onEventSpyName = jest.fn();
    onEventSpyId = jest.fn();

    await Promise.all([amqp.connect(), postgres.connect()]);

    await app.setup.registerAggregateCommandHandler(
      new AggregateCommandHandlerImplementation<CreateGreeting, GreetingCreated>({
        commandName: "create_greeting",
        aggregate: { name: "test_aggregate", context: "es_postgres" },
        conditions: { created: false },
        schema: Joi.object()
          .keys({
            create: Joi.boolean().required(),
          })
          .required(),
        handler: async (ctx) => {
          await ctx.apply(new GreetingCreated(ctx.command.create));
        },
      }),
    );
    await app.setup.registerAggregateCommandHandler(
      new AggregateCommandHandlerImplementation<UpdateGreeting, GreetingUpdated>({
        commandName: "update_greeting",
        aggregate: { name: "test_aggregate", context: "es_postgres" },
        conditions: { created: true },
        schema: Joi.object()
          .keys({
            update: Joi.boolean().required(),
          })
          .required(),
        handler: async (ctx) => {
          await ctx.apply(new GreetingUpdated(ctx.command.update));
        },
      }),
    );

    await app.setup.registerAggregateEventHandler(
      new AggregateEventHandlerImplementation<GreetingCreated>({
        eventName: "greeting_created",
        aggregate: { name: "test_aggregate", context: "es_postgres" },
        handler: async (ctx) => {
          ctx.mergeState(ctx.event);
        },
      }),
    );
    await app.setup.registerAggregateEventHandler(
      new AggregateEventHandlerImplementation<GreetingUpdated>({
        eventName: "greeting_updated",
        aggregate: { name: "test_aggregate", context: "es_postgres" },
        handler: async (ctx) => {
          ctx.mergeState(ctx.event);
        },
      }),
    );

    await app.setup.registerQueryHandler(
      new QueryHandlerImplementation<QueryGreeting, unknown>({
        queryName: "query_greeting",
        view: { name: "test_view", context: "es_postgres" },
        handler: (ctx) => ctx.repositories.postgres.findById(ctx.query.id),
      }),
    );

    await app.setup.registerSagaEventHandler(
      new SagaEventHandlerImplementation<GreetingCreated>({
        eventName: "greeting_created",
        aggregate: { name: "test_aggregate", context: "es_postgres" },
        saga: { name: "test_saga", context: "es_postgres" },
        conditions: { created: false },
        getSagaId: (event) => event.aggregate.id,
        handler: async (ctx) => {
          ctx.mergeState(ctx.event);
          ctx.logger.info("GreetingCreatedEvent", { event: ctx.event });

          ctx.dispatch(new UpdateGreeting(true), { delay: 500 });
        },
      }),
    );
    await app.setup.registerSagaEventHandler(
      new SagaEventHandlerImplementation<GreetingUpdated>({
        eventName: "greeting_updated",
        aggregate: { name: "test_aggregate", context: "es_postgres" },
        saga: { name: "test_saga", context: "es_postgres" },
        conditions: { created: true },
        getSagaId: (event) => event.aggregate.id,
        handler: async (ctx) => {
          ctx.mergeState(ctx.event);
          ctx.logger.info("GreetingUpdatedEvent", { event: ctx.event });
        },
      }),
    );

    await app.setup.registerViewEventHandler(
      new ViewEventHandlerImplementation<GreetingCreated>({
        eventName: "greeting_created",
        adapters: { postgres: { ViewEntity } },
        aggregate: { name: "test_aggregate", context: "es_postgres" },
        view: { name: "test_view", context: "es_postgres" },
        conditions: { created: false },
        getViewId: (event) => event.aggregate.id,
        handler: async (ctx) => {
          ctx.setState({ created: ctx.event.created });
        },
      }),
    );
    await app.setup.registerViewEventHandler(
      new ViewEventHandlerImplementation<GreetingUpdated>({
        eventName: "greeting_updated",
        adapters: { postgres: { ViewEntity } },
        aggregate: { name: "test_aggregate", context: "es_postgres" },
        view: { name: "test_view", context: "es_postgres" },
        conditions: { created: true },
        getViewId: (event) => event.aggregate.id,
        handler: async (ctx) => {
          ctx.mergeState({ updated: ctx.event.updated });
        },
      }),
    );

    app.setup.registerCommandAggregate("create_greeting", "test_aggregate");
    app.setup.registerCommandAggregate("update_greeting", "test_aggregate");

    app.setup.registerViewEntity({ name: "test_view", context: "es_postgres" }, ViewEntity);
  }, 30000);

  afterAll(async () => {
    await Promise.all([amqp.disconnect(), postgres.disconnect()]);
  });

  test("should publish", async () => {
    const id = randomUUID();
    let viewChangeCount = 0;

    app.on("view", () => {
      onEventSpyAll();
      viewChangeCount += 1;
    });
    app.on("view.es_postgres", onEventSpyContext);
    app.on("view.es_postgres.test_view", onEventSpyName);
    app.on(`view.es_postgres.test_view.${id}`, onEventSpyId);

    await app.publish(new CreateGreeting(true), { aggregate: { id } });

    await new Promise((resolve) => {
      const interval = setInterval(() => {
        if (viewChangeCount >= 2) {
          clearInterval(interval);
          resolve(undefined);
        }
      }, 250);
    });

    await expect(
      app.admin.inspect.aggregate({ id, name: "test_aggregate" }),
    ).resolves.toStrictEqual(
      expect.objectContaining({
        id,
        name: "test_aggregate",
        context: "es_postgres",
        destroyed: false,
        events: [expect.any(DomainEvent), expect.any(DomainEvent)],
        numberOfLoadedEvents: 2,
        state: {
          created: true,
          updated: true,
        },
      }),
    );

    await expect(app.admin.inspect.saga({ id, name: "test_saga" })).resolves.toStrictEqual(
      expect.objectContaining({
        id: id,
        name: "test_saga",
        context: "es_postgres",
        processedCausationIds: [expect.any(String), expect.any(String)],
        destroyed: false,
        messagesToDispatch: [],
        revision: 3,
        state: {
          created: true,
          updated: true,
        },
      }),
    );

    await expect(app.admin.inspect.view({ id, name: "test_view" })).resolves.toStrictEqual(
      expect.objectContaining({
        id,
        name: "test_view",
        context: "es_postgres",
        destroyed: false,
        hash: expect.any(String),
        meta: {
          created: {
            destroyed: false,
            timestamp: expect.any(String),
            value: true,
          },
          updated: {
            destroyed: false,
            timestamp: expect.any(String),
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

    await expect(app.query(new QueryGreeting(id))).resolves.toStrictEqual({
      id,
      name: "test_view",
      context: "es_postgres",
      revision: 2,
      state: {
        created: true,
        updated: true,
      },
      created_at: expect.any(Date),
      updated_at: expect.any(Date),
    });

    expect(onEventSpyAll).toHaveBeenCalledTimes(2);
    expect(onEventSpyContext).toHaveBeenCalledTimes(2);
    expect(onEventSpyName).toHaveBeenCalledTimes(2);
    expect(onEventSpyId).toHaveBeenCalledTimes(2);
  }, 10000);
});
