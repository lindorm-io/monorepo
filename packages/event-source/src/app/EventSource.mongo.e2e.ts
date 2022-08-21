import Joi from "joi";
import { AmqpConnection } from "@lindorm-io/amqp";
import { DomainEvent } from "../message";
import { EventSource } from "./EventSource";
import { EventStoreType, SagaStoreType, ViewStoreType } from "../enum";
import { MongoConnection } from "@lindorm-io/mongo";
import { createMockLogger } from "@lindorm-io/winston";
import { randomUUID } from "crypto";
import { sleep } from "@lindorm-io/core";
import {
  AggregateCommandHandler,
  AggregateEventHandler,
  SagaEventHandler,
  ViewEventHandler,
} from "../handler";

describe("EventSource (Mongo)", () => {
  const logger = createMockLogger();

  let amqp: AmqpConnection;
  let app: EventSource;
  let mongo: MongoConnection;

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

    mongo = new MongoConnection(
      {
        host: "localhost",
        port: 27011,
        auth: { username: "root", password: "example" },
        authSource: "admin",
        database: "App",
      },
      logger,
    );

    app = new EventSource(
      {
        amqp,
        mongo,
        domain: { context: "es_mongo" },
        dangerouslyRegisterHandlersManually: true,
        aggregates: { type: EventStoreType.MONGO },
        sagas: { type: SagaStoreType.MONGO },
        views: { type: ViewStoreType.MONGO },
      },
      logger,
    );

    onEventSpyAll = jest.fn();
    onEventSpyContext = jest.fn();
    onEventSpyName = jest.fn();
    onEventSpyId = jest.fn();

    await Promise.all([amqp.connect(), mongo.connect()]);

    await app.setup.registerAggregateCommandHandlers([
      new AggregateCommandHandler({
        commandName: "create",
        aggregate: { name: "greeting", context: "es_mongo" },
        conditions: { created: false },
        schema: Joi.object()
          .keys({
            initial: Joi.string().required(),
          })
          .required(),
        handler: async (ctx) => {
          await ctx.apply("created", ctx.command.data);
        },
      }),
      new AggregateCommandHandler({
        commandName: "update",
        aggregate: { name: "greeting", context: "es_mongo" },
        conditions: { created: true },
        schema: Joi.object()
          .keys({
            greeting: Joi.string().required(),
          })
          .required(),
        handler: async (ctx) => {
          await ctx.apply("updated", ctx.command.data);
        },
      }),
      new AggregateCommandHandler({
        commandName: "respond",
        aggregate: { name: "response", context: "es_mongo" },
        conditions: { created: false },
        schema: Joi.object()
          .keys({
            respond: Joi.string().required(),
          })
          .required(),
        handler: async (ctx) => {
          await ctx.apply("responded", ctx.command.data);
        },
      }),
    ]);

    await app.setup.registerAggregateEventHandlers([
      new AggregateEventHandler({
        eventName: "created",
        aggregate: { name: "greeting", context: "es_mongo" },
        handler: async (ctx) => {
          ctx.setState("created", true);
          ctx.mergeState(ctx.event.data);
        },
      }),
      new AggregateEventHandler({
        eventName: "updated",
        aggregate: { name: "greeting", context: "es_mongo" },
        handler: async (ctx) => {
          ctx.setState("updated", true);
          ctx.mergeState(ctx.event.data);
        },
      }),
      new AggregateEventHandler({
        eventName: "responded",
        aggregate: { name: "response", context: "es_mongo" },
        handler: async (ctx) => {
          ctx.setState("responded", true);
          ctx.mergeState(ctx.event.data);
        },
      }),
    ]);

    await app.setup.registerSagaEventHandlers([
      new SagaEventHandler({
        eventName: "created",
        aggregate: { name: "greeting", context: "es_mongo" },
        saga: { name: "test_saga", context: "es_mongo" },
        conditions: { created: false },
        getSagaId: (event) => event.aggregate.id,
        handler: async (ctx) => {
          ctx.mergeState(ctx.event.data);
          ctx.dispatch("update", { greeting: "Hello There" });
        },
      }),
      new SagaEventHandler({
        eventName: "updated",
        aggregate: { name: "greeting", context: "es_mongo" },
        saga: { name: "test_saga", context: "es_mongo" },
        conditions: { created: true },
        getSagaId: (event) => event.aggregate.id,
        handler: async (ctx) => {
          ctx.mergeState(ctx.event.data);
          ctx.dispatch(
            "respond",
            { respond: "General Kenobi" },
            { aggregate: { name: "response" } },
          );
        },
      }),
      new SagaEventHandler({
        eventName: "responded",
        aggregate: { name: "response", context: "es_mongo" },
        saga: { name: "test_saga", context: "es_mongo" },
        conditions: { created: true },
        getSagaId: (event) => event.aggregate.id,
        handler: async (ctx) => {
          ctx.mergeState(ctx.event.data);
        },
      }),
    ]);

    await app.setup.registerViewEventHandlers([
      new ViewEventHandler({
        adapters: {},
        eventName: "created",
        aggregate: { name: "greeting", context: "es_mongo" },
        view: { name: "test_view", context: "es_mongo" },
        conditions: { created: false },
        getViewId: (event) => event.aggregate.id,
        handler: async (ctx) => {
          ctx.addListItem("messages", ctx.event.data.initial);
        },
      }),
      new ViewEventHandler({
        adapters: {},
        eventName: "updated",
        aggregate: { name: "greeting", context: "es_mongo" },
        view: { name: "test_view", context: "es_mongo" },
        conditions: { created: true },
        getViewId: (event) => event.aggregate.id,
        handler: async (ctx) => {
          ctx.addListItem("messages", ctx.event.data.greeting);
        },
      }),
      new ViewEventHandler({
        adapters: {},
        eventName: "responded",
        aggregate: { name: "response", context: "es_mongo" },
        view: { name: "test_view", context: "es_mongo" },
        conditions: { created: true },
        getViewId: (event) => event.aggregate.id,
        handler: async (ctx) => {
          ctx.addListItem("messages", ctx.event.data.respond);
        },
      }),
    ]);
  }, 30000);

  afterAll(async () => {
    await Promise.all([amqp.disconnect(), mongo.disconnect()]);
  });

  test("should publish", async () => {
    const id = randomUUID();

    app.on("view", onEventSpyAll);
    app.on("view.es_mongo", onEventSpyContext);
    app.on("view.es_mongo.test_view", onEventSpyName);
    app.on(`view.es_mongo.test_view.${id}`, onEventSpyId);

    await app.publish({
      aggregate: { id, name: "greeting" },
      name: "create",
      data: { initial: "Hi" },
    });

    await sleep(8000);

    await expect(app.admin.inspect.aggregate({ id, name: "greeting" })).resolves.toStrictEqual(
      expect.objectContaining({
        id,
        name: "greeting",
        context: "es_mongo",
        destroyed: false,
        events: [expect.any(DomainEvent), expect.any(DomainEvent)],
        numberOfLoadedEvents: 2,
        state: {
          created: true,
          greeting: "Hello There",
          initial: "Hi",
          updated: true,
        },
      }),
    );

    await expect(app.admin.inspect.saga({ id, name: "test_saga" })).resolves.toStrictEqual(
      expect.objectContaining({
        id: id,
        name: "test_saga",
        context: "es_mongo",
        processedCausationIds: [expect.any(String), expect.any(String), expect.any(String)],
        destroyed: false,
        messagesToDispatch: [],
        revision: 5,
        state: {
          initial: "Hi",
          greeting: "Hello There",
          respond: "General Kenobi",
        },
      }),
    );

    await expect(app.repositories.mongo("test_view").findById(id)).resolves.toStrictEqual({
      id,
      name: "test_view",
      context: "es_mongo",
      revision: 3,
      state: { messages: ["Hi", "Hello There", "General Kenobi"] },
      created_at: expect.any(Date),
      updated_at: expect.any(Date),
    });

    expect(onEventSpyAll).toHaveBeenCalledTimes(3);
    expect(onEventSpyContext).toHaveBeenCalledTimes(3);
    expect(onEventSpyName).toHaveBeenCalledTimes(3);
    expect(onEventSpyId).toHaveBeenCalledTimes(3);
  }, 10000);
});
