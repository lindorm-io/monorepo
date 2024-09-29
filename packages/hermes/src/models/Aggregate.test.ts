import { TEST_AGGREGATE_OPTIONS } from "../__fixtures__/aggregate";
import {
  TEST_AGGREGATE_EVENT_HANDLER,
  TEST_AGGREGATE_EVENT_HANDLER_DESTROY,
  TEST_AGGREGATE_EVENT_HANDLER_DESTROY_NEXT,
  TEST_AGGREGATE_EVENT_HANDLER_MERGE_STATE,
  TEST_AGGREGATE_EVENT_HANDLER_SET_STATE,
  TEST_AGGREGATE_EVENT_HANDLER_THROWS,
} from "../__fixtures__/aggregate-event-handler";
import {
  TEST_HERMES_COMMAND,
  TEST_HERMES_COMMAND_SET_STATE,
} from "../__fixtures__/hermes-command";
import {
  TEST_HERMES_EVENT,
  TEST_HERMES_EVENT_DESTROY,
  TEST_HERMES_EVENT_DESTROY_NEXT,
  TEST_HERMES_EVENT_MERGE_STATE,
  TEST_HERMES_EVENT_SET_STATE,
  TEST_HERMES_EVENT_THROWS,
} from "../__fixtures__/hermes-event";
import {
  AggregateDestroyedError,
  AggregateNotDestroyedError,
  HandlerNotRegisteredError,
} from "../errors";
import { InvalidMessageTypeError } from "../errors/InvalidMessageTypeError";
import { HermesCommand, HermesEvent } from "../messages";
import { Aggregate } from "./Aggregate";

describe("Aggregate", () => {
  let aggregate: Aggregate;

  beforeEach(() => {
    aggregate = new Aggregate({
      ...TEST_AGGREGATE_OPTIONS,
      eventHandlers: [
        TEST_AGGREGATE_EVENT_HANDLER,
        TEST_AGGREGATE_EVENT_HANDLER_DESTROY,
        TEST_AGGREGATE_EVENT_HANDLER_DESTROY_NEXT,
        TEST_AGGREGATE_EVENT_HANDLER_MERGE_STATE,
        TEST_AGGREGATE_EVENT_HANDLER_SET_STATE,
        TEST_AGGREGATE_EVENT_HANDLER_THROWS,
      ],
    });
  });

  test("should construct", () => {
    expect(() => new Aggregate(TEST_AGGREGATE_OPTIONS)).not.toThrow();
  });

  test("should return json object", async () => {
    expect(aggregate.toJSON()).toEqual({
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
    class HermesEventSetState {
      public constructor(public readonly applyEventData: boolean) {}
    }

    await expect(
      aggregate.apply(
        new HermesCommand(TEST_HERMES_COMMAND_SET_STATE),
        new HermesEventSetState(true),
      ),
    ).resolves.toBeUndefined();

    expect(aggregate.destroyed).toBe(false);
    expect(aggregate.events).toEqual([expect.any(HermesEvent)]);
    expect(aggregate.numberOfLoadedEvents).toBe(0);
    expect(aggregate.state).toEqual({ set: "state" });
  });

  test("should load one event", async () => {
    const event = new HermesEvent(TEST_HERMES_EVENT_MERGE_STATE);

    await expect(aggregate.load(event)).resolves.toBeUndefined();

    expect(aggregate.destroyed).toBe(false);
    expect(aggregate.events).toEqual([event]);
    expect(aggregate.numberOfLoadedEvents).toBe(1);
    expect(aggregate.state).toEqual({
      merge: {
        hermesEventData: true,
      },
    });
    expect(aggregate.state).toEqual({
      merge: {
        hermesEventData: true,
      },
    });
  });

  test("should load multiple events", async () => {
    const event1 = new HermesEvent(TEST_HERMES_EVENT_MERGE_STATE);
    const event2 = new HermesEvent(TEST_HERMES_EVENT_SET_STATE);
    const event3 = new HermesEvent(TEST_HERMES_EVENT_DESTROY_NEXT);
    const event4 = new HermesEvent(TEST_HERMES_EVENT_DESTROY);

    await expect(aggregate.load(event1)).resolves.toBeUndefined();
    await expect(aggregate.load(event2)).resolves.toBeUndefined();
    await expect(aggregate.load(event3)).resolves.toBeUndefined();
    await expect(aggregate.load(event4)).resolves.toBeUndefined();

    expect(aggregate.destroyed).toBe(true);
    expect(aggregate.events).toEqual([event1, event2, event3, event4]);
    expect(aggregate.numberOfLoadedEvents).toBe(4);
    expect(aggregate.state).toEqual({
      merge: {
        hermesEventData: true,
      },
      set: "state",
    });
  });

  test("should throw on erroneous event type", async () => {
    await expect(aggregate.load(new HermesCommand(TEST_HERMES_COMMAND))).rejects.toThrow(
      InvalidMessageTypeError,
    );
  });

  test("should throw on destroyed aggregate", async () => {
    await aggregate.load(new HermesEvent(TEST_HERMES_EVENT_DESTROY));

    await expect(
      aggregate.load(new HermesEvent(TEST_HERMES_EVENT_MERGE_STATE)),
    ).rejects.toThrow(AggregateDestroyedError);
  });

  test("should throw on unregistered aggregate event handler", async () => {
    aggregate = new Aggregate(TEST_AGGREGATE_OPTIONS);

    await expect(aggregate.load(new HermesEvent(TEST_HERMES_EVENT))).rejects.toThrow(
      HandlerNotRegisteredError,
    );
  });

  test("should throw on event handler error", async () => {
    await expect(
      aggregate.load(new HermesEvent(TEST_HERMES_EVENT_THROWS)),
    ).rejects.toThrow(new Error("throw"));
  });

  test("should throw on un-destroyed aggregate", async () => {
    await aggregate.load(new HermesEvent(TEST_HERMES_EVENT_DESTROY_NEXT));

    await expect(
      aggregate.load(new HermesEvent(TEST_HERMES_EVENT_MERGE_STATE)),
    ).rejects.toThrow(AggregateNotDestroyedError);
  });
});
