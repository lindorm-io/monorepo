import { DomainEvent } from "../message";
import { TEST_VIEW_OPTIONS } from "../fixtures/view.fixture";
import { View } from "./View";
import { ViewDestroyedError } from "../error";
import { addDays } from "date-fns";
import { createMockLogger } from "@lindorm-io/winston";
import {
  TEST_DOMAIN_EVENT,
  TEST_DOMAIN_EVENT_OPTIONS,
  TEST_DOMAIN_EVENT_REMOVE_FIELD_WHERE_EQUAL,
  TEST_DOMAIN_EVENT_REMOVE_FIELD_WHERE_MATCH,
} from "../fixtures/domain-event.fixture";

describe("View", () => {
  const logger = createMockLogger();

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
      causationList: [],
      context: "viewContext",
      destroyed: false,
      id: expect.any(String),
      meta: {},
      name: "viewName",
      revision: 0,
      state: {},
    });
  });

  test("should add field to new array", () => {
    expect(() => view.addField(new DomainEvent(TEST_DOMAIN_EVENT), "path", "value")).not.toThrow();

    expect(view.state).toStrictEqual({
      path: ["value"],
    });

    expect(view.meta).toStrictEqual({
      path: [{ removed: false, timestamp: expect.any(Date), value: "value" }],
    });
  });

  test("should add field to initialised array", () => {
    view = new View(
      {
        ...TEST_VIEW_OPTIONS,
        state: { path: ["value"] },
      },
      logger,
    );

    expect(() => view.addField(new DomainEvent(TEST_DOMAIN_EVENT), "path", "extra")).not.toThrow();

    expect(view.state).toStrictEqual({
      path: ["value", "extra"],
    });
  });

  test("should ignore add field when more recent change exists", () => {
    const timestamp = addDays(new Date(), 1);
    const event = new DomainEvent({
      ...TEST_DOMAIN_EVENT_OPTIONS,
      timestamp,
    });

    view.addField(event, "path", "value");

    expect(() => view.addField(new DomainEvent(TEST_DOMAIN_EVENT), "path", "value")).not.toThrow();

    expect(view.state).toStrictEqual({
      path: ["value"],
    });
    expect(view.meta).toStrictEqual({
      path: [{ removed: false, timestamp, value: "value" }],
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

    expect(view.getState()).toStrictEqual({ test: true });
  });

  test("should destroy", () => {
    expect(() => view.destroy()).not.toThrow();

    expect(view.destroyed).toBe(true);
  });

  test("should remove field where equal", () => {
    view = new View(
      {
        ...TEST_VIEW_OPTIONS,
        state: { path: ["value"] },
      },
      logger,
    );

    expect(() =>
      view.removeFieldWhereEqual(
        new DomainEvent(TEST_DOMAIN_EVENT_REMOVE_FIELD_WHERE_EQUAL),
        "path",
        "value",
      ),
    ).not.toThrow();

    expect(view.state).toStrictEqual({
      path: [],
    });
  });

  test("should ignore remove field where equal when more recent change exists", () => {
    const timestamp = addDays(new Date(), 1);
    const event = new DomainEvent({
      ...TEST_DOMAIN_EVENT_OPTIONS,
      timestamp,
    });

    view.addField(event, "path", "value");

    expect(() =>
      view.removeFieldWhereEqual(new DomainEvent(TEST_DOMAIN_EVENT), "path", "value"),
    ).not.toThrow();

    expect(view.state).toStrictEqual({
      path: ["value"],
    });
    expect(view.meta).toStrictEqual({
      path: [{ removed: false, timestamp, value: "value" }],
    });
  });

  test("should remove field where matching", () => {
    view = new View(
      {
        ...TEST_VIEW_OPTIONS,
        state: { path: [{ value: 1 }, { value: 2 }] },
      },
      logger,
    );

    expect(() =>
      view.removeFieldWhereMatch(
        new DomainEvent(TEST_DOMAIN_EVENT_REMOVE_FIELD_WHERE_MATCH),
        "path",
        { value: 1 },
      ),
    ).not.toThrow();

    expect(view.state).toStrictEqual({
      path: [{ value: 2 }],
    });
  });

  test("should ignore remove field where match when more recent change exists", () => {
    const timestamp = addDays(new Date(), 1);
    const event = new DomainEvent({
      ...TEST_DOMAIN_EVENT_OPTIONS,
      timestamp,
    });

    view.addField(event, "path", { value: 1 });

    expect(() =>
      view.removeFieldWhereMatch(new DomainEvent(TEST_DOMAIN_EVENT), "path", { value: 1 }),
    ).not.toThrow();

    expect(view.state).toStrictEqual({
      path: [{ value: 1 }],
    });
    expect(view.meta).toStrictEqual({
      path: [{ removed: false, timestamp, value: { value: 1 } }],
    });
  });

  test("should set state", () => {
    expect(() =>
      view.setState(new DomainEvent(TEST_DOMAIN_EVENT_REMOVE_FIELD_WHERE_MATCH), "path", {
        setState: true,
      }),
    ).not.toThrow();

    expect(view.state).toStrictEqual({
      path: { setState: true },
    });
  });

  test("should ignore set state when more recent change exists", () => {
    const timestamp = addDays(new Date(), 1);
    const event = new DomainEvent({
      ...TEST_DOMAIN_EVENT_OPTIONS,
      timestamp,
    });

    view.setState(event, "path", { value: 1 });

    expect(() =>
      view.setState(new DomainEvent(TEST_DOMAIN_EVENT), "path", { value: 2 }),
    ).not.toThrow();

    expect(view.state).toStrictEqual({
      path: { value: 1 },
    });
    expect(view.meta).toStrictEqual({
      path: { removed: false, timestamp, value: { value: 1 } },
    });
  });

  test("should throw on add field when destroyed", () => {
    view = new View(
      {
        ...TEST_VIEW_OPTIONS,
        destroyed: true,
      },
      logger,
    );

    expect(() => view.addField(new DomainEvent(TEST_DOMAIN_EVENT), "path", "extra")).toThrow(
      ViewDestroyedError,
    );
  });

  test("should throw on destroy when destroyed", () => {
    view = new View(
      {
        ...TEST_VIEW_OPTIONS,
        destroyed: true,
      },
      logger,
    );

    expect(() => view.destroy()).toThrow(ViewDestroyedError);
  });

  test("should throw on remove field where equal when destroyed", () => {
    view = new View(
      {
        ...TEST_VIEW_OPTIONS,
        destroyed: true,
      },
      logger,
    );

    expect(() =>
      view.removeFieldWhereEqual(new DomainEvent(TEST_DOMAIN_EVENT), "path", "value"),
    ).toThrow(ViewDestroyedError);
  });

  test("should throw on remove field where equal when destroyed", () => {
    view = new View(
      {
        ...TEST_VIEW_OPTIONS,
        destroyed: true,
      },
      logger,
    );

    expect(() =>
      view.removeFieldWhereMatch(new DomainEvent(TEST_DOMAIN_EVENT), "path", { value: 1 }),
    ).toThrow(ViewDestroyedError);
  });

  test("should throw on set state when destroyed", () => {
    view = new View(
      {
        ...TEST_VIEW_OPTIONS,
        destroyed: true,
      },
      logger,
    );

    expect(() =>
      view.setState(new DomainEvent(TEST_DOMAIN_EVENT), "path", { setState: true }),
    ).toThrow(ViewDestroyedError);
  });
});
