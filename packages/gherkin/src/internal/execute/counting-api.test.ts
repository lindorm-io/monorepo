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
});
