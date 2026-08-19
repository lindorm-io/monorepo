import { describe, expect, test } from "vitest";
import { createFakeSuiteApi } from "../../__fixtures__/suite-api.js";
import { createCountingSuiteApi } from "./counting-api.js";

describe("createCountingSuiteApi", () => {
  test("should count every test registration and delegate it", () => {
    const fake = createFakeSuiteApi();
    const counting = createCountingSuiteApi(fake.api);

    expect(counting.registered()).toBe(0);

    counting.api.test("first", () => {});
    counting.api.test("second", () => {});

    expect(counting.registered()).toBe(2);
    expect(fake.tests.map((entry) => entry.name)).toEqual(["first", "second"]);
  });

  test("should pass describe through untouched", () => {
    const fake = createFakeSuiteApi();
    const counting = createCountingSuiteApi(fake.api);

    expect(counting.api.describe).toBe(fake.api.describe);
  });

  test("should pass beforeAll and afterAll through UNCOUNTED", () => {
    const fake = createFakeSuiteApi();
    const counting = createCountingSuiteApi(fake.api);

    // Identity: lifecycle registrations never enter the structural invariant —
    // a wrapper here would be a place for a count to sneak in.
    expect(counting.api.beforeAll).toBe(fake.api.beforeAll);
    expect(counting.api.afterAll).toBe(fake.api.afterAll);

    counting.api.beforeAll(() => {});
    counting.api.afterAll(() => {});

    expect(counting.registered()).toBe(0);
    expect(fake.lifecycles.map((entry) => entry.kind)).toEqual(["beforeAll", "afterAll"]);
  });
});
