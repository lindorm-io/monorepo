import { Cache } from "./Cache";
import { CacheDestroyedError } from "../error";
import { DomainEvent } from "../message";
import { TEST_CACHE_OPTIONS } from "../fixtures/cache.fixture";
import { addDays } from "date-fns";
import { createMockLogger } from "@lindorm-io/winston";
import {
  TEST_DOMAIN_EVENT,
  TEST_DOMAIN_EVENT_OPTIONS,
  TEST_DOMAIN_EVENT_REMOVE_FIELD_WHERE_EQUAL,
  TEST_DOMAIN_EVENT_REMOVE_FIELD_WHERE_MATCH,
} from "../fixtures/domain-event.fixture";

describe("Cache", () => {
  const logger = createMockLogger();

  let cache: Cache;

  beforeEach(() => {
    cache = new Cache(TEST_CACHE_OPTIONS, logger);
  });

  test("should construct", () => {
    expect(() => new Cache(TEST_CACHE_OPTIONS, logger)).not.toThrow();
  });

  test("should throw on invalid name", () => {
    expect(
      () =>
        new Cache(
          {
            ...TEST_CACHE_OPTIONS,
            name: "erroneous-name_standard",
          },
          logger,
        ),
    ).toThrow();
  });

  test("should return json object", async () => {
    expect(cache.toJSON()).toStrictEqual({
      causationList: [],
      context: "default",
      destroyed: false,
      id: expect.any(String),
      meta: {},
      name: "cache_name",
      revision: 0,
      state: {},
    });
  });

  test("should add field to new array", () => {
    expect(() => cache.addField(new DomainEvent(TEST_DOMAIN_EVENT), "path", "value")).not.toThrow();

    expect(cache.state).toStrictEqual({
      path: ["value"],
    });

    expect(cache.meta).toStrictEqual({
      path: [{ removed: false, timestamp: expect.any(Date), value: "value" }],
    });
  });

  test("should add field to initialised array", () => {
    cache = new Cache(
      {
        ...TEST_CACHE_OPTIONS,
        state: { path: ["value"] },
      },
      logger,
    );

    expect(() => cache.addField(new DomainEvent(TEST_DOMAIN_EVENT), "path", "extra")).not.toThrow();

    expect(cache.state).toStrictEqual({
      path: ["value", "extra"],
    });
  });

  test("should ignore add field when more recent change exists", () => {
    const timestamp = addDays(new Date(), 1);
    const event = new DomainEvent({
      ...TEST_DOMAIN_EVENT_OPTIONS,
      timestamp,
    });

    cache.addField(event, "path", "value");

    expect(() => cache.addField(new DomainEvent(TEST_DOMAIN_EVENT), "path", "value")).not.toThrow();

    expect(cache.state).toStrictEqual({
      path: ["value"],
    });
    expect(cache.meta).toStrictEqual({
      path: [{ removed: false, timestamp, value: "value" }],
    });
  });

  test("should get state", () => {
    cache = new Cache(
      {
        ...TEST_CACHE_OPTIONS,
        state: { test: true },
      },
      logger,
    );

    expect(cache.getState()).toStrictEqual({ test: true });
  });

  test("should destroy", () => {
    expect(() => cache.destroy()).not.toThrow();

    expect(cache.destroyed).toBe(true);
  });

  test("should remove field where equal", () => {
    cache = new Cache(
      {
        ...TEST_CACHE_OPTIONS,
        state: { path: ["value"] },
      },
      logger,
    );

    expect(() =>
      cache.removeFieldWhereEqual(
        new DomainEvent(TEST_DOMAIN_EVENT_REMOVE_FIELD_WHERE_EQUAL),
        "path",
        "value",
      ),
    ).not.toThrow();

    expect(cache.state).toStrictEqual({
      path: [],
    });
  });

  test("should ignore remove field where equal when more recent change exists", () => {
    const timestamp = addDays(new Date(), 1);
    const event = new DomainEvent({
      ...TEST_DOMAIN_EVENT_OPTIONS,
      timestamp,
    });

    cache.addField(event, "path", "value");

    expect(() =>
      cache.removeFieldWhereEqual(new DomainEvent(TEST_DOMAIN_EVENT), "path", "value"),
    ).not.toThrow();

    expect(cache.state).toStrictEqual({
      path: ["value"],
    });
    expect(cache.meta).toStrictEqual({
      path: [{ removed: false, timestamp, value: "value" }],
    });
  });

  test("should remove field where matching", () => {
    cache = new Cache(
      {
        ...TEST_CACHE_OPTIONS,
        state: { path: [{ value: 1 }, { value: 2 }] },
      },
      logger,
    );

    expect(() =>
      cache.removeFieldWhereMatch(
        new DomainEvent(TEST_DOMAIN_EVENT_REMOVE_FIELD_WHERE_MATCH),
        "path",
        { value: 1 },
      ),
    ).not.toThrow();

    expect(cache.state).toStrictEqual({
      path: [{ value: 2 }],
    });
  });

  test("should ignore remove field where match when more recent change exists", () => {
    const timestamp = addDays(new Date(), 1);
    const event = new DomainEvent({
      ...TEST_DOMAIN_EVENT_OPTIONS,
      timestamp,
    });

    cache.addField(event, "path", { value: 1 });

    expect(() =>
      cache.removeFieldWhereMatch(new DomainEvent(TEST_DOMAIN_EVENT), "path", { value: 1 }),
    ).not.toThrow();

    expect(cache.state).toStrictEqual({
      path: [{ value: 1 }],
    });
    expect(cache.meta).toStrictEqual({
      path: [{ removed: false, timestamp, value: { value: 1 } }],
    });
  });

  test("should set state", () => {
    expect(() =>
      cache.setState(new DomainEvent(TEST_DOMAIN_EVENT_REMOVE_FIELD_WHERE_MATCH), "path", {
        setState: true,
      }),
    ).not.toThrow();

    expect(cache.state).toStrictEqual({
      path: { setState: true },
    });
  });

  test("should ignore set state when more recent change exists", () => {
    const timestamp = addDays(new Date(), 1);
    const event = new DomainEvent({
      ...TEST_DOMAIN_EVENT_OPTIONS,
      timestamp,
    });

    cache.setState(event, "path", { value: 1 });

    expect(() =>
      cache.setState(new DomainEvent(TEST_DOMAIN_EVENT), "path", { value: 2 }),
    ).not.toThrow();

    expect(cache.state).toStrictEqual({
      path: { value: 1 },
    });
    expect(cache.meta).toStrictEqual({
      path: { removed: false, timestamp, value: { value: 1 } },
    });
  });

  test("should throw on add field when destroyed", () => {
    cache = new Cache(
      {
        ...TEST_CACHE_OPTIONS,
        destroyed: true,
      },
      logger,
    );

    expect(() => cache.addField(new DomainEvent(TEST_DOMAIN_EVENT), "path", "extra")).toThrow(
      CacheDestroyedError,
    );
  });

  test("should throw on destroy when destroyed", () => {
    cache = new Cache(
      {
        ...TEST_CACHE_OPTIONS,
        destroyed: true,
      },
      logger,
    );

    expect(() => cache.destroy()).toThrow(CacheDestroyedError);
  });

  test("should throw on remove field where equal when destroyed", () => {
    cache = new Cache(
      {
        ...TEST_CACHE_OPTIONS,
        destroyed: true,
      },
      logger,
    );

    expect(() =>
      cache.removeFieldWhereEqual(new DomainEvent(TEST_DOMAIN_EVENT), "path", "value"),
    ).toThrow(CacheDestroyedError);
  });

  test("should throw on remove field where equal when destroyed", () => {
    cache = new Cache(
      {
        ...TEST_CACHE_OPTIONS,
        destroyed: true,
      },
      logger,
    );

    expect(() =>
      cache.removeFieldWhereMatch(new DomainEvent(TEST_DOMAIN_EVENT), "path", { value: 1 }),
    ).toThrow(CacheDestroyedError);
  });

  test("should throw on set state when destroyed", () => {
    cache = new Cache(
      {
        ...TEST_CACHE_OPTIONS,
        destroyed: true,
      },
      logger,
    );

    expect(() =>
      cache.setState(new DomainEvent(TEST_DOMAIN_EVENT), "path", { setState: true }),
    ).toThrow(CacheDestroyedError);
  });
});
