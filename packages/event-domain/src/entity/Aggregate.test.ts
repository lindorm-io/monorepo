import { Aggregate } from "./Aggregate";
import { Command, DomainEvent } from "../message";
import { TEST_AGGREGATE_OPTIONS } from "../fixtures/aggregate.fixture";
import { TEST_COMMAND, TEST_COMMAND_SET_STATE } from "../fixtures/command.fixture";
import { createMockLogger } from "@lindorm-io/winston";
import {
  AggregateDestroyedError,
  AggregateNotDestroyedError,
  HandlerNotRegisteredError,
  MessageTypeError,
} from "../error";
import {
  TEST_AGGREGATE_EVENT_HANDLER,
  TEST_AGGREGATE_EVENT_HANDLER_DESTROY,
  TEST_AGGREGATE_EVENT_HANDLER_DESTROY_NEXT,
  TEST_AGGREGATE_EVENT_HANDLER_MERGE_STATE,
  TEST_AGGREGATE_EVENT_HANDLER_SET_STATE,
  TEST_AGGREGATE_EVENT_HANDLER_THROWS,
} from "../fixtures/aggregate-event-handler.fixture";
import {
  TEST_DOMAIN_EVENT,
  TEST_DOMAIN_EVENT_DESTROY,
  TEST_DOMAIN_EVENT_DESTROY_NEXT,
  TEST_DOMAIN_EVENT_MERGE_STATE,
  TEST_DOMAIN_EVENT_SET_STATE,
  TEST_DOMAIN_EVENT_THROWS,
} from "../fixtures/domain-event.fixture";

describe("Aggregate", () => {
  const logger = createMockLogger();

  let aggregate: Aggregate;

  beforeEach(() => {
    aggregate = new Aggregate(
      {
        ...TEST_AGGREGATE_OPTIONS,
        eventHandlers: [
          TEST_AGGREGATE_EVENT_HANDLER,
          TEST_AGGREGATE_EVENT_HANDLER_DESTROY,
          TEST_AGGREGATE_EVENT_HANDLER_DESTROY_NEXT,
          TEST_AGGREGATE_EVENT_HANDLER_MERGE_STATE,
          TEST_AGGREGATE_EVENT_HANDLER_SET_STATE,
          TEST_AGGREGATE_EVENT_HANDLER_THROWS,
        ],
      },
      logger,
    );
  });

  test("should construct", () => {
    expect(() => new Aggregate(TEST_AGGREGATE_OPTIONS, logger)).not.toThrow();
  });

  test("should throw on invalid name", () => {
    expect(
      () =>
        new Aggregate(
          {
            ...TEST_AGGREGATE_OPTIONS,
            name: "erroneous-name_standard",
          },
          logger,
        ),
    ).toThrow();
  });

  test("should return json object", async () => {
    expect(aggregate.toJSON()).toStrictEqual({
      context: "default",
      destroyed: false,
      events: [],
      id: expect.any(String),
      name: "aggregate_name",
      numberOfLoadedEvents: 0,
      state: {},
    });
  });

  test("should apply", async () => {
    await expect(
      aggregate.apply(new Command(TEST_COMMAND_SET_STATE), TEST_DOMAIN_EVENT_SET_STATE.name, {
        applyEventData: true,
      }),
    ).resolves.toBeUndefined();

    expect(aggregate.destroyed).toBe(false);
    expect(aggregate.events).toStrictEqual([expect.any(DomainEvent)]);
    expect(aggregate.numberOfLoadedEvents).toBe(0);
    expect(aggregate.state).toStrictEqual({
      path: {
        value: { applyEventData: true },
      },
    });
  });

  test("should load one event", async () => {
    const event = new DomainEvent(TEST_DOMAIN_EVENT_MERGE_STATE);

    await expect(aggregate.load(event)).resolves.toBeUndefined();

    expect(aggregate.destroyed).toBe(false);
    expect(aggregate.events).toStrictEqual([event]);
    expect(aggregate.numberOfLoadedEvents).toBe(1);
    expect(aggregate.state).toStrictEqual({
      merge: {
        domainEventData: true,
      },
    });
    expect(aggregate.getState()).toStrictEqual({
      merge: {
        domainEventData: true,
      },
    });
  });

  test("should load multiple events", async () => {
    const event1 = new DomainEvent(TEST_DOMAIN_EVENT_MERGE_STATE);
    const event2 = new DomainEvent(TEST_DOMAIN_EVENT_SET_STATE);
    const event3 = new DomainEvent(TEST_DOMAIN_EVENT_DESTROY_NEXT);
    const event4 = new DomainEvent(TEST_DOMAIN_EVENT_DESTROY);

    await expect(aggregate.load(event1)).resolves.toBeUndefined();
    await expect(aggregate.load(event2)).resolves.toBeUndefined();
    await expect(aggregate.load(event3)).resolves.toBeUndefined();
    await expect(aggregate.load(event4)).resolves.toBeUndefined();

    expect(aggregate.destroyed).toBe(true);
    expect(aggregate.events).toStrictEqual([event1, event2, event3, event4]);
    expect(aggregate.numberOfLoadedEvents).toBe(4);
    expect(aggregate.state).toStrictEqual({
      merge: {
        domainEventData: true,
      },
      path: {
        value: {
          domainEventData: true,
        },
      },
    });
  });

  test("should throw on erroneous event type", async () => {
    await expect(aggregate.load(new Command(TEST_COMMAND))).rejects.toThrow(MessageTypeError);
  });

  test("should throw on destroyed aggregate", async () => {
    await aggregate.load(new DomainEvent(TEST_DOMAIN_EVENT_DESTROY));

    await expect(aggregate.load(new DomainEvent(TEST_DOMAIN_EVENT_MERGE_STATE))).rejects.toThrow(
      AggregateDestroyedError,
    );
  });

  test("should throw on unregistered aggregate event handler", async () => {
    aggregate = new Aggregate(TEST_AGGREGATE_OPTIONS, logger);

    await expect(aggregate.load(new DomainEvent(TEST_DOMAIN_EVENT))).rejects.toThrow(
      HandlerNotRegisteredError,
    );
  });

  test("should throw on event handler error", async () => {
    await expect(aggregate.load(new DomainEvent(TEST_DOMAIN_EVENT_THROWS))).rejects.toThrow(
      new Error("throw"),
    );
  });

  test("should throw on un-destroyed aggregate", async () => {
    await aggregate.load(new DomainEvent(TEST_DOMAIN_EVENT_DESTROY_NEXT));

    await expect(aggregate.load(new DomainEvent(TEST_DOMAIN_EVENT_MERGE_STATE))).rejects.toThrow(
      AggregateNotDestroyedError,
    );
  });
});
