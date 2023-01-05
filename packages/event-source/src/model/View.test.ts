import { DomainEvent } from "../message";
import { TEST_DOMAIN_EVENT } from "../fixtures/domain-event.fixture";
import { TEST_VIEW_OPTIONS } from "../fixtures/view.fixture";
import { View } from "./View";
import { ViewDestroyedError } from "../error";
import { createMockLogger } from "@lindorm-io/core-logger";

describe("View", () => {
  const logger = createMockLogger();
  const domainEvent = new DomainEvent(TEST_DOMAIN_EVENT);

  let view: View;

  beforeEach(() => {
    view = new View(TEST_VIEW_OPTIONS, logger);
  });

  test("should construct", () => {
    expect(() => new View(TEST_VIEW_OPTIONS, logger)).not.toThrow();
  });

  test("should throw on invalid name", () => {
    expect(
      () =>
        new View(
          {
            ...TEST_VIEW_OPTIONS,
            name: "erroneous-name_standard",
          },
          logger,
        ),
    ).toThrow();
  });

  test("should return json object", async () => {
    expect(view.toJSON()).toStrictEqual({
      id: expect.any(String),
      name: "name",
      context: "default",
      destroyed: false,
      hash: expect.any(String),
      meta: {},
      processedCausationIds: [],
      revision: 0,
      state: {},
    });
  });

  test("should get state", () => {
    view = new View(
      {
        ...TEST_VIEW_OPTIONS,
        state: { test: true },
      },
      logger,
    );

    expect(view.state).toStrictEqual({ test: true });
    expect(view.meta).toStrictEqual({});
  });

  test("should destroy", () => {
    expect(() => view.destroy(domainEvent)).not.toThrow();

    expect(view.destroyed).toBe(true);
  });

  test("should merge state", () => {
    expect(() => view.mergeState(domainEvent, { merge: "mergeState" })).not.toThrow();

    expect(view.state).toStrictEqual({ merge: "mergeState" });
    expect(view.meta).toStrictEqual({
      merge: {
        destroyed: false,
        timestamp: expect.any(Date),
        value: "mergeState",
      },
    });
  });

  test("should set state", () => {
    expect(() => view.setState(domainEvent, { setState: true })).not.toThrow();

    expect(view.state).toStrictEqual({ setState: true });
    expect(view.meta).toStrictEqual({
      setState: {
        destroyed: false,
        timestamp: expect.any(Date),
        value: true,
      },
    });
  });

  test("should throw on destroy when destroyed", () => {
    view = new View(
      {
        ...TEST_VIEW_OPTIONS,
        destroyed: true,
      },
      logger,
    );

    expect(() => view.destroy(domainEvent)).toThrow(ViewDestroyedError);
  });

  test("should throw on merge state when destroyed", () => {
    view = new View(
      {
        ...TEST_VIEW_OPTIONS,
        destroyed: true,
      },
      logger,
    );

    expect(() => view.mergeState(domainEvent, { setState: true })).toThrow(ViewDestroyedError);
  });

  test("should throw on set state when destroyed", () => {
    view = new View(
      {
        ...TEST_VIEW_OPTIONS,
        destroyed: true,
      },
      logger,
    );

    expect(() => view.setState(domainEvent, { setState: true })).toThrow(ViewDestroyedError);
  });
});
