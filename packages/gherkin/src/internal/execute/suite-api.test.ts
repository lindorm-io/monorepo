import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { createFakeSuiteApi } from "../../__fixtures__/suite-api.js";
import { resolveSuiteApi, vitestSuiteApi } from "./suite-api.js";

describe("resolveSuiteApi", () => {
  test("should default to vitest's real describe, test, beforeAll and afterAll", () => {
    const api = resolveSuiteApi(undefined);

    expect(api).toBe(vitestSuiteApi);
    expect(api.describe).toBe(describe);
    // .skip is a chainable GETTER on vitest's api — each access mints a new
    // function, so identity cannot be asserted; presence can.
    expect(api.describe.skip).toBeInstanceOf(Function);
    expect(api.test).toBe(test);
    expect(api.beforeAll).toBe(beforeAll);
    expect(api.afterAll).toBe(afterAll);
  });

  test("should return an injected api untouched", () => {
    const fake = createFakeSuiteApi();

    expect(resolveSuiteApi(fake.api)).toBe(fake.api);
  });
});
