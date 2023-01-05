import { DomainEvent, TimeoutMessage } from "../message";
import { Saga } from "./Saga";
import { SagaDestroyedError } from "../error";
import { TEST_DOMAIN_EVENT } from "../fixtures/domain-event.fixture";
import { TEST_SAGA_OPTIONS } from "../fixtures/saga.fixture";
import { createMockLogger } from "@lindorm-io/core-logger";

describe("Saga", () => {
  const logger = createMockLogger();

  let saga: Saga;

  beforeEach(() => {
    saga = new Saga(TEST_SAGA_OPTIONS, logger);
  });

  test("should construct", () => {
    expect(() => new Saga(TEST_SAGA_OPTIONS, logger)).not.toThrow();
  });

  test("should throw on invalid name", () => {
    expect(
      () =>
        new Saga(
          {
            ...TEST_SAGA_OPTIONS,
            name: "erroneous-name_standard",
          },
          logger,
        ),
    ).toThrow();
  });

  test("should return json object", async () => {
    expect(saga.toJSON()).toStrictEqual({
      id: expect.any(String),
      name: "name",
      context: "default",
      destroyed: false,
      hash: expect.any(String),
      messagesToDispatch: [],
      processedCausationIds: [],
      revision: 0,
      state: {},
    });
  });

  test("should destroy", () => {
    expect(() => saga.destroy()).not.toThrow();

    expect(saga.destroyed).toBe(true);
  });

  test("should dispatch command", () => {
    class DispatchedCommand {
      public constructor(public readonly dispatchedData: any) {}
    }

    const event = new DomainEvent(TEST_DOMAIN_EVENT);

    expect(() => saga.dispatch(event, new DispatchedCommand(true))).not.toThrow();

    expect(saga.messagesToDispatch).toStrictEqual([
      expect.objectContaining({
        id: expect.any(String),
        name: "dispatched_command",
        aggregate: event.aggregate,
        causationId: expect.any(String),
        correlationId: event.correlationId,
        data: { dispatchedData: true },
        delay: 0,
        mandatory: true,
        metadata: {
          origin: "test",
        },
        timestamp: expect.any(Date),
        topic: "default.aggregate_name.dispatched_command",
        type: "command",
        version: 1,
      }),
    ]);
  });

  test("should get state", () => {
    saga = new Saga(
      {
        ...TEST_SAGA_OPTIONS,
        state: { test: true },
      },
      logger,
    );

    expect(saga.state).toStrictEqual({ test: true });
  });

  test("should merge state", () => {
    expect(() => saga.mergeState({ merge: "mergeState" })).not.toThrow();

    expect(saga.state).toStrictEqual({
      merge: "mergeState",
    });
  });

  test("should dispatch timeout event", () => {
    expect(() =>
      saga.timeout(new DomainEvent(TEST_DOMAIN_EVENT), "timeoutName", { timeoutData: true }, 250),
    ).not.toThrow();

    expect(saga.messagesToDispatch).toStrictEqual([expect.any(TimeoutMessage)]);
  });

  test("should throw on destroy when destroyed", () => {
    saga = new Saga(
      {
        ...TEST_SAGA_OPTIONS,
        destroyed: true,
      },
      logger,
    );

    expect(() => saga.destroy()).toThrow(SagaDestroyedError);
  });

  test("should throw on dispatch when destroyed", () => {
    class DispatchedCommand {
      public constructor(public readonly data: any) {}
    }

    saga = new Saga(
      {
        ...TEST_SAGA_OPTIONS,
        destroyed: true,
      },
      logger,
    );

    expect(() =>
      saga.dispatch(new DomainEvent(TEST_DOMAIN_EVENT), new DispatchedCommand("destroyed")),
    ).toThrow(SagaDestroyedError);
  });

  test("should throw on merge state when destroyed", () => {
    saga = new Saga(
      {
        ...TEST_SAGA_OPTIONS,
        destroyed: true,
      },
      logger,
    );

    expect(() => saga.mergeState({ merge: "mergeState" })).toThrow(SagaDestroyedError);
  });

  test("should throw on merge state when destroyed", () => {
    saga = new Saga(
      {
        ...TEST_SAGA_OPTIONS,
        destroyed: true,
      },
      logger,
    );

    expect(() => saga.mergeState({ value: "setState" })).toThrow(SagaDestroyedError);
  });

  test("should throw on dispatch timeout event when destroyed", () => {
    saga = new Saga(
      {
        ...TEST_SAGA_OPTIONS,
        destroyed: true,
      },
      logger,
    );

    expect(() =>
      saga.timeout(new DomainEvent(TEST_DOMAIN_EVENT), "timeoutName", { timeoutData: true }, 250),
    ).toThrow();
  });
});
