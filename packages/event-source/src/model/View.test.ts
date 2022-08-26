import { TEST_VIEW_OPTIONS } from "../fixtures/view.fixture";
import { View } from "./View";
import { ViewDestroyedError } from "../error";
import { createMockLogger } from "@lindorm-io/winston";
import { DomainEvent } from "../message";
import { TEST_DOMAIN_EVENT } from "../fixtures/domain-event.fixture";

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
      name: "view_name",
      context: "default",
      destroyed: false,
      hash: expect.any(String),
      modified: null,
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
  });

  test("should destroy", () => {
    expect(() => view.destroy(domainEvent)).not.toThrow();

    expect(view.destroyed).toBe(true);
  });

  test("should merge state", () => {
    expect(() => view.mergeState(domainEvent, { merge: "mergeState" })).not.toThrow();

    expect(view.state).toStrictEqual({
      merge: "mergeState",
    });
  });

  test("should set state", () => {
    expect(() => view.setState(domainEvent, { setState: true })).not.toThrow();

    expect(view.state).toStrictEqual({ setState: true });
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
