import { DomainEvent, TimeoutEvent } from "../message";
import { Saga } from "./Saga";
import { SagaDestroyedError } from "../error";
import { TEST_DOMAIN_EVENT } from "../fixtures/domain-event.fixture";
import { TEST_SAGA_OPTIONS } from "../fixtures/saga.fixture";
import { createMockLogger } from "@lindorm-io/winston";

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
      causationList: [],
      context: "default",
      destroyed: false,
      id: expect.any(String),
      messagesToDispatch: [],
      name: "saga_name",
      revision: 0,
      state: {},
    });
  });

  test("should destroy", () => {
    expect(() => saga.destroy()).not.toThrow();

    expect(saga.destroyed).toBe(true);
  });

  test("should dispatch command", () => {
    const event = new DomainEvent(TEST_DOMAIN_EVENT);

    expect(() =>
      saga.dispatch(event, "dispatchedCommand", {
        dispatchedData: true,
      }),
    ).not.toThrow();

    expect(saga.messagesToDispatch).toStrictEqual([
      expect.objectContaining({
        id: expect.any(String),
        name: "dispatchedCommand",
        aggregate: event.aggregate,
        causationId: expect.any(String),
        correlationId: event.correlationId,
        data: { dispatchedData: true },
        delay: 0,
        mandatory: true,
        routingKey: "default.aggregate_name.dispatchedCommand",
        timestamp: expect.any(Date),
        type: "command",
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

    expect(saga.getState()).toStrictEqual({ test: true });
  });

  test("should merge state", () => {
    expect(() => saga.mergeState({ merge: "mergeState" })).not.toThrow();

    expect(saga.state).toStrictEqual({
      merge: "mergeState",
    });
  });

  test("should set state", () => {
    expect(() => saga.setState("path", { value: "setState" })).not.toThrow();

    expect(saga.state).toStrictEqual({
      path: {
        value: "setState",
      },
    });
  });

  test("should dispatch timeout event", () => {
    expect(() =>
      saga.timeout(new DomainEvent(TEST_DOMAIN_EVENT), "timeoutName", { timeoutData: true }, 250),
    ).not.toThrow();

    expect(saga.messagesToDispatch).toStrictEqual([expect.any(TimeoutEvent)]);
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
    saga = new Saga(
      {
        ...TEST_SAGA_OPTIONS,
        destroyed: true,
      },
      logger,
    );

    expect(() => saga.dispatch(new DomainEvent(TEST_DOMAIN_EVENT), "destroyed", {})).toThrow(
      SagaDestroyedError,
    );
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

    expect(() => saga.setState("path", { value: "setState" })).toThrow(SagaDestroyedError);
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
