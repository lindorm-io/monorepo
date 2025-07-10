import { createMockLogger } from "@lindorm/logger";
import { createMockRabbitMessageBus } from "@lindorm/rabbit";
import { createTestCommand, createTestEvent } from "../__fixtures__/create-message";
import { createTestAggregateIdentifier } from "../__fixtures__/create-test-aggregate-identifier";
import { createTestRegistry } from "../__fixtures__/create-test-registry";
import { TestCommandCreate } from "../__fixtures__/modules/commands/TestCommandCreate";
import { TestEventCreate } from "../__fixtures__/modules/events/TestEventCreate";
import { TestEventDestroy } from "../__fixtures__/modules/events/TestEventDestroy";
import { TestEventDestroyNext } from "../__fixtures__/modules/events/TestEventDestroyNext";
import { TestEventMergeState } from "../__fixtures__/modules/events/TestEventMergeState";
import { TestEventSetState } from "../__fixtures__/modules/events/TestEventSetState";
import { TestEventThrows } from "../__fixtures__/modules/events/TestEventThrows";
import { Event } from "../decorators";
import {
  AggregateDestroyedError,
  AggregateNotDestroyedError,
  HandlerNotRegisteredError,
  InvalidMessageTypeError,
} from "../errors";
import { HermesEvent } from "../messages";
import { AggregateModelOptions } from "../types";
import { AggregateModel } from "./AggregateModel";

describe("AggregateModel", () => {
  const std: AggregateModelOptions = {
    ...createTestAggregateIdentifier(),
    eventBus: createMockRabbitMessageBus(HermesEvent),
    logger: createMockLogger(),
    registry: createTestRegistry(),
  };

  let aggregate: AggregateModel;

  beforeEach(() => {
    aggregate = new AggregateModel(std);
  });

  test("should construct", () => {
    expect(() => new AggregateModel(std)).not.toThrow();
  });

  test("should return json object", async () => {
    expect(aggregate.toJSON()).toEqual({
      context: "hermes",
      destroyed: false,
      events: [],
      id: expect.any(String),
      name: "test_aggregate",
      numberOfLoadedEvents: 0,
      state: {},
    });
  });

  test("should apply", async () => {
    await expect(
      aggregate.apply(
        createTestCommand(new TestCommandCreate("create")),
        new TestEventCreate("create"),
      ),
    ).resolves.toBeUndefined();

    expect(aggregate.destroyed).toEqual(false);
    expect(aggregate.events).toEqual([expect.any(HermesEvent)]);
    expect(aggregate.numberOfLoadedEvents).toEqual(0);
    expect(aggregate.state).toEqual({ create: "create" });
  });

  test("should load one event", async () => {
    const event = createTestEvent(new TestEventCreate("create"));

    await expect(aggregate.load(event)).resolves.toBeUndefined();

    expect(aggregate.destroyed).toEqual(false);
    expect(aggregate.events).toEqual([event]);
    expect(aggregate.numberOfLoadedEvents).toEqual(1);
    expect(aggregate.state).toEqual({
      create: "create",
    });
  });

  test("should load multiple events", async () => {
    const event1 = createTestEvent(new TestEventMergeState("merge-state"));
    const event2 = createTestEvent(new TestEventSetState("set-state"));
    const event3 = createTestEvent(new TestEventDestroyNext("destroy-next"));
    const event4 = createTestEvent(new TestEventDestroy("destroy"));

    await expect(aggregate.load(event1)).resolves.toBeUndefined();
    await expect(aggregate.load(event2)).resolves.toBeUndefined();
    await expect(aggregate.load(event3)).resolves.toBeUndefined();
    await expect(aggregate.load(event4)).resolves.toBeUndefined();

    expect(aggregate.destroyed).toEqual(true);
    expect(aggregate.events).toEqual([event1, event2, event3, event4]);
    expect(aggregate.numberOfLoadedEvents).toEqual(4);
    expect(aggregate.state).toEqual({
      destroy: "destroy",
      destroyNext: "destroy-next",
      mergeState: "merge-state",
      setState: "set-state",
    });
  });

  test("should throw on erroneous event type", async () => {
    await expect(
      aggregate.load(createTestCommand(new TestCommandCreate("throw"))),
    ).rejects.toThrow(InvalidMessageTypeError);
  });

  test("should throw on destroyed aggregate", async () => {
    await aggregate.load(createTestEvent(new TestEventDestroy("destroy")));

    await expect(
      aggregate.load(createTestEvent(new TestEventMergeState("merge-state"))),
    ).rejects.toThrow(AggregateDestroyedError);
  });

  test("should throw on unregistered aggregate event handler", async () => {
    @Event()
    class UnregisteredEvent {
      public constructor(public readonly data: string = "data") {}
    }

    createTestRegistry().addEvents([UnregisteredEvent]);

    await expect(
      aggregate.load(createTestEvent(new UnregisteredEvent())),
    ).rejects.toThrow(HandlerNotRegisteredError);
  });

  test("should throw on event handler error", async () => {
    await expect(
      aggregate.load(createTestEvent(new TestEventThrows("throw"))),
    ).rejects.toThrow(new Error("throw"));
  });

  test("should throw on un-destroyed aggregate", async () => {
    await aggregate.load(createTestEvent(new TestEventDestroyNext("destroy-next")));

    await expect(
      aggregate.load(createTestEvent(new TestEventMergeState("merge-state"))),
    ).rejects.toThrow(AggregateNotDestroyedError);
  });
});
