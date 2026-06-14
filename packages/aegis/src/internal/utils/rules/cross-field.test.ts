import { describe, expect, test } from "vitest";
import { crossField } from "./cross-field.js";

describe("crossField", () => {
  test("passes when exp > iat and nbf <= exp", () => {
    expect(crossField({ iat: 100, nbf: 100, exp: 200 })).toEqual([]);
  });

  test("ignores absent timestamps", () => {
    expect(crossField({})).toEqual([]);
  });

  test("fails when exp <= iat", () => {
    expect(crossField({ iat: 200, exp: 200 })).toMatchSnapshot();
  });

  test("fails when nbf > exp", () => {
    expect(crossField({ nbf: 300, exp: 200 })).toMatchSnapshot();
  });
});
