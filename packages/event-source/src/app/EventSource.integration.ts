import Joi from "joi";
import { AmqpConnection } from "@lindorm-io/amqp";
import { DomainEvent } from "../message";
import { EventEntity } from "../infrastructure";
import { EventSource } from "./EventSource";
import { MongoConnection } from "@lindorm-io/mongo";
import { PostgresConnection } from "@lindorm-io/postgres";
import { RedisConnection } from "@lindorm-io/redis";
import { createMockLogger } from "@lindorm-io/winston";
import { createViewEntities } from "../util";
import { randomUUID } from "crypto";
import { sleep } from "@lindorm-io/core";
import {
  AggregateCommandHandler,
  AggregateEventHandler,
  SagaEventHandler,
  ViewEventHandler,
} from "../handler";

describe("App", () => {
  const logger = createMockLogger();
  const { ViewEntity, ViewCausationEntity } = createViewEntities("AppView");

  let amqp: AmqpConnection;
  let app: EventSource;
  let mongo: MongoConnection;
  let postgres: PostgresConnection;
  let redis: RedisConnection;

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

    postgres = new PostgresConnection(
      {
        host: "localhost",
        port: 5432,
        username: "root",
        password: "example",
        database: "default_db",
        entities: [EventEntity, ViewEntity, ViewCausationEntity],
        synchronize: true,
      },
      logger,
    );

    redis = new RedisConnection(
      {
        host: "localhost",
        port: 6371,
      },
      logger,
    );

    app = new EventSource(
      {
        amqp,
        mongo,
        postgres,
        redis,
        domain: { context: "default" },
        dangerouslyRegisterHandlersManually: true,
        aggregates: { persistence: "postgres" },
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
        aggregate: { name: "greeting", context: "default" },
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
        aggregate: { name: "greeting", context: "default" },
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
        aggregate: { name: "response", context: "default" },
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
        aggregate: { name: "greeting", context: "default" },
        handler: async (ctx) => {
          ctx.setState("created", true);
          ctx.mergeState(ctx.event.data);
        },
      }),
      new AggregateEventHandler({
        eventName: "updated",
        aggregate: { name: "greeting", context: "default" },
        handler: async (ctx) => {
          ctx.setState("updated", true);
          ctx.mergeState(ctx.event.data);
        },
      }),
      new AggregateEventHandler({
        eventName: "responded",
        aggregate: { name: "response", context: "default" },
        handler: async (ctx) => {
          ctx.setState("responded", true);
          ctx.mergeState(ctx.event.data);
        },
      }),
    ]);

    await app.setup.registerSagaEventHandlers([
      new SagaEventHandler({
        eventName: "created",
        aggregate: { name: "greeting", context: "default" },
        saga: { name: "log_greeting", context: "default" },
        conditions: { created: false },
        getSagaId: (event) => event.aggregate.id,
        handler: async (ctx) => {
          ctx.mergeState(ctx.event.data);
          ctx.dispatch("update", { greeting: "Hello There" });
        },
      }),
      new SagaEventHandler({
        eventName: "updated",
        aggregate: { name: "greeting", context: "default" },
        saga: { name: "log_greeting", context: "default" },
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
        aggregate: { name: "response", context: "default" },
        saga: { name: "log_greeting", context: "default" },
        conditions: { created: true },
        getSagaId: (event) => event.aggregate.id,
        handler: async (ctx) => {
          ctx.mergeState(ctx.event.data);
        },
      }),
    ]);

    await app.setup.registerViewEventHandlers([
      new ViewEventHandler({
        eventName: "created",
        aggregate: { name: "greeting", context: "default" },
        view: { name: "saved_greetings", context: "default" },
        conditions: { created: false },
        persistence: { type: "mongo" },
        getViewId: (event) => event.aggregate.id,
        handler: async (ctx) => {
          ctx.addListItem("messages", ctx.event.data.initial);
        },
      }),
      new ViewEventHandler({
        eventName: "updated",
        aggregate: { name: "greeting", context: "default" },
        view: { name: "saved_greetings", context: "default" },
        conditions: { created: true },
        persistence: { type: "mongo" },
        getViewId: (event) => event.aggregate.id,
        handler: async (ctx) => {
          ctx.addListItem("messages", ctx.event.data.greeting);
        },
      }),
      new ViewEventHandler({
        eventName: "responded",
        aggregate: { name: "response", context: "default" },
        view: { name: "saved_greetings", context: "default" },
        conditions: { created: true },
        persistence: { type: "mongo" },
        getViewId: (event) => event.aggregate.id,
        handler: async (ctx) => {
          ctx.addListItem("messages", ctx.event.data.respond);
        },
      }),
    ]);

    await app.setup.registerViewEventHandlers([
      new ViewEventHandler({
        eventName: "created",
        aggregate: { name: "greeting", context: "default" },
        view: { name: "stored_greetings", context: "default" },
        conditions: { created: false },
        persistence: {
          type: "postgres",
          postgres: { viewEntity: ViewEntity, causationEntity: ViewCausationEntity },
        },
        getViewId: (event) => event.aggregate.id,
        handler: async (ctx) => {
          ctx.addListItem("messages", ctx.event.data.initial);
        },
      }),
      new ViewEventHandler({
        eventName: "updated",
        aggregate: { name: "greeting", context: "default" },
        view: { name: "stored_greetings", context: "default" },
        conditions: { created: true },
        persistence: {
          type: "postgres",
          postgres: { viewEntity: ViewEntity, causationEntity: ViewCausationEntity },
        },
        getViewId: (event) => event.aggregate.id,
        handler: async (ctx) => {
          ctx.addListItem("messages", ctx.event.data.greeting);
        },
      }),
      new ViewEventHandler({
        eventName: "responded",
        aggregate: { name: "response", context: "default" },
        view: { name: "stored_greetings", context: "default" },
        conditions: { created: true },
        persistence: {
          type: "postgres",
          postgres: { viewEntity: ViewEntity, causationEntity: ViewCausationEntity },
        },
        getViewId: (event) => event.aggregate.id,
        handler: async (ctx) => {
          ctx.addListItem("messages", ctx.event.data.respond);
        },
      }),
    ]);

    await app.setup.registerViewEventHandlers([
      new ViewEventHandler({
        eventName: "created",
        aggregate: { name: "greeting", context: "default" },
        view: { name: "cached_greetings", context: "default" },
        conditions: { created: false },
        persistence: { type: "redis" },
        getViewId: (event) => event.aggregate.id,
        handler: async (ctx) => {
          ctx.addListItem("messages", ctx.event.data.initial);
        },
      }),
      new ViewEventHandler({
        eventName: "updated",
        aggregate: { name: "greeting", context: "default" },
        view: { name: "cached_greetings", context: "default" },
        conditions: { created: true },
        persistence: { type: "redis" },
        getViewId: (event) => event.aggregate.id,
        handler: async (ctx) => {
          ctx.addListItem("messages", ctx.event.data.greeting);
        },
      }),
      new ViewEventHandler({
        eventName: "responded",
        aggregate: { name: "response", context: "default" },
        view: { name: "cached_greetings", context: "default" },
        conditions: { created: true },
        persistence: { type: "redis" },
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

  test("should resolve", async () => {
    const id = randomUUID();

    app.on("view", onEventSpyAll);
    app.on("view.default", onEventSpyContext);
    app.on("view.default.saved_greetings", onEventSpyName);
    app.on(`view.default.saved_greetings.${id}`, onEventSpyId);

    await app.publish({
      aggregate: { id, name: "greeting" },
      name: "create",
      data: { initial: "Hi" },
    });

    await sleep(5000);

    await expect(app.admin.inspect.aggregate({ id, name: "greeting" })).resolves.toStrictEqual(
      expect.objectContaining({
        id,
        name: "greeting",
        context: "default",
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

    await expect(app.admin.inspect.saga({ id, name: "log_greeting" })).resolves.toStrictEqual(
      expect.objectContaining({
        id: id,
        name: "log_greeting",
        context: "default",
        causationList: [expect.any(String), expect.any(String), expect.any(String)],
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

    await expect(app.repositories.mongo("saved_greetings").findById(id)).resolves.toStrictEqual({
      id,
      name: "saved_greetings",
      context: "default",
      revision: 3,
      state: { messages: ["Hi", "Hello There", "General Kenobi"] },
      created_at: expect.any(Date),
      updated_at: expect.any(Date),
    });

    await expect(app.repositories.postgres("stored_greetings").findById(id)).resolves.toStrictEqual(
      {
        id,
        name: "stored_greetings",
        context: "default",
        revision: 3,
        state: { messages: ["Hi", "Hello There", "General Kenobi"] },
        created_at: expect.any(Date),
        updated_at: expect.any(Date),
      },
    );

    await expect(app.repositories.redis("cached_greetings").findById(id)).resolves.toStrictEqual({
      id,
      name: "cached_greetings",
      context: "default",
      revision: 3,
      state: { messages: ["Hi", "Hello There", "General Kenobi"] },
      created_at: expect.any(Date),
      updated_at: expect.any(Date),
    });

    expect(onEventSpyAll).toHaveBeenCalledTimes(9);
    expect(onEventSpyContext).toHaveBeenCalledTimes(9);
    expect(onEventSpyName).toHaveBeenCalledTimes(3);
    expect(onEventSpyId).toHaveBeenCalledTimes(3);
  }, 10000);
});
