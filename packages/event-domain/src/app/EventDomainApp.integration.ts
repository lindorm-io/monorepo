import Joi from "joi";
import { AmqpConnection } from "@lindorm-io/amqp";
import { EventDomainApp } from "./EventDomainApp";
import { MongoConnection } from "@lindorm-io/mongo";
import { RedisConnection } from "@lindorm-io/redis";
import { CacheRepository, ViewRepository } from "../infrastructure";
import { createMockLogger } from "@lindorm-io/winston";
import { randomUUID } from "crypto";
import { sleep } from "@lindorm-io/core";
import {
  AggregateCommandHandler,
  AggregateEventHandler,
  CacheEventHandler,
  SagaEventHandler,
  ViewEventHandler,
} from "../handler";
import { DomainEvent } from "../message";

describe("EventDomainApp", () => {
  const logger = createMockLogger();

  let amqp: AmqpConnection;
  let app: EventDomainApp;
  let cacheRepo: CacheRepository<any>;
  let viewRepo: ViewRepository<any>;
  let mongo: MongoConnection;
  let redis: RedisConnection;

  let onEventSpyAll: jest.Mock;
  let onEventSpyContext: jest.Mock;
  let onEventSpyName: jest.Mock;
  let onEventSpyId: jest.Mock;
  let onEventSpyCache: jest.Mock;

  beforeAll(async () => {
    amqp = new AmqpConnection({
      hostname: "localhost",
      logger,
      port: 5671,
      connectInterval: 500,
      connectTimeout: 30000,
    });

    mongo = new MongoConnection({
      host: "localhost",
      port: 27011,
      auth: { username: "root", password: "example" },
      logger,
    });

    redis = new RedisConnection({
      host: "localhost",
      port: 6371,
      logger,
    });

    app = new EventDomainApp({
      amqp,
      mongo,
      redis,
      logger,
      domain: { context: "default", database: "default" },
      dangerouslyRegisterHandlersManually: true,
    });

    cacheRepo = app.createCacheRepository("saved_greetings");
    viewRepo = app.createViewRepository("saved_greetings");

    onEventSpyAll = jest.fn();
    onEventSpyContext = jest.fn();
    onEventSpyName = jest.fn();
    onEventSpyId = jest.fn();
    onEventSpyCache = jest.fn();

    await Promise.all([amqp.connect(), mongo.connect()]);

    await app.registerAggregateCommandHandlers([
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

    await app.registerAggregateEventHandlers([
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

    await app.registerCacheEventHandlers([
      new CacheEventHandler({
        eventName: "created",
        aggregate: { name: "greeting", context: "default" },
        cache: { name: "saved_greetings", context: "default" },
        conditions: { created: false },
        getCacheId: (event) => event.aggregate.id,
        handler: async (ctx) => {
          ctx.addField("messages", ctx.event.data.initial);
        },
      }),
      new CacheEventHandler({
        eventName: "updated",
        aggregate: { name: "greeting", context: "default" },
        cache: { name: "saved_greetings", context: "default" },
        conditions: { created: true },
        getCacheId: (event) => event.aggregate.id,
        handler: async (ctx) => {
          ctx.addField("messages", ctx.event.data.greeting);
        },
      }),
      new CacheEventHandler({
        eventName: "responded",
        aggregate: { name: "response", context: "default" },
        cache: { name: "saved_greetings", context: "default" },
        conditions: { created: true },
        getCacheId: (event) => event.aggregate.id,
        handler: async (ctx) => {
          ctx.addField("messages", ctx.event.data.respond);
        },
      }),
    ]);

    await app.registerSagaEventHandlers([
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

    await app.registerViewEventHandlers([
      new ViewEventHandler({
        eventName: "created",
        aggregate: { name: "greeting", context: "default" },
        view: { name: "saved_greetings", context: "default" },
        conditions: { created: false },
        getViewId: (event) => event.aggregate.id,
        handler: async (ctx) => {
          ctx.addField("messages", ctx.event.data.initial);
        },
      }),
      new ViewEventHandler({
        eventName: "updated",
        aggregate: { name: "greeting", context: "default" },
        view: { name: "saved_greetings", context: "default" },
        conditions: { created: true },
        getViewId: (event) => event.aggregate.id,
        handler: async (ctx) => {
          ctx.addField("messages", ctx.event.data.greeting);
        },
      }),
      new ViewEventHandler({
        eventName: "responded",
        aggregate: { name: "response", context: "default" },
        view: { name: "saved_greetings", context: "default" },
        conditions: { created: true },
        getViewId: (event) => event.aggregate.id,
        handler: async (ctx) => {
          ctx.addField("messages", ctx.event.data.respond);
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
    app.on("view.default.saved_greetings." + id, onEventSpyId);
    app.on("cache", onEventSpyCache);

    await app.publish({
      aggregate: { id, name: "greeting" },
      name: "create",
      data: { initial: "Hi" },
    });

    await sleep(5000);

    await expect(app.inspect({ id, name: "greeting" })).resolves.toStrictEqual(
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

    await expect(
      app.query(
        { collection: "views_default_saved_greetings" },
        {
          id,
          name: "saved_greetings",
          context: "default",
        },
      ),
    ).resolves.toStrictEqual([
      {
        _id: expect.any(Object),
        id,
        name: "saved_greetings",
        context: "default",
        causationList: [expect.any(String), expect.any(String), expect.any(String)],
        destroyed: false,
        meta: {
          messages: [
            { removed: false, timestamp: expect.any(Date), value: "Hi" },
            { removed: false, timestamp: expect.any(Date), value: "Hello There" },
            { removed: false, timestamp: expect.any(Date), value: "General Kenobi" },
          ],
        },
        revision: 3,
        state: { messages: ["Hi", "Hello There", "General Kenobi"] },
        timeModified: expect.any(Date),
        timestamp: expect.any(Date),
      },
    ]);

    await expect(cacheRepo.get(id)).resolves.toStrictEqual({
      id,
      revision: 3,
      state: { messages: ["Hi", "Hello There", "General Kenobi"] },
    });

    await expect(viewRepo.findOne({ id })).resolves.toStrictEqual({
      id,
      revision: 3,
      state: { messages: ["Hi", "Hello There", "General Kenobi"] },
      timeModified: expect.any(Date),
    });

    expect(onEventSpyAll).toHaveBeenCalledTimes(3);

    expect(onEventSpyAll).toHaveBeenNthCalledWith(1, {
      id,
      name: "saved_greetings",
      context: "default",
      revision: 1,
      state: {
        messages: ["Hi"],
      },
    });

    expect(onEventSpyAll).toHaveBeenNthCalledWith(2, {
      id,
      name: "saved_greetings",
      context: "default",
      revision: 2,
      state: {
        messages: ["Hi", "Hello There"],
      },
    });

    expect(onEventSpyAll).toHaveBeenNthCalledWith(3, {
      id,
      name: "saved_greetings",
      context: "default",
      revision: 3,
      state: {
        messages: ["Hi", "Hello There", "General Kenobi"],
      },
    });

    expect(onEventSpyContext).toHaveBeenCalledTimes(3);
    expect(onEventSpyName).toHaveBeenCalledTimes(3);
    expect(onEventSpyId).toHaveBeenCalledTimes(3);
    expect(onEventSpyCache).toHaveBeenCalledTimes(3);
  }, 10000);
});
