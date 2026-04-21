import { reverseDictValues } from "./reverse-dict-values.js";
import { describe, expect, test } from "vitest";

describe("reverseDictValues", () => {
  test("should swap keys and values", () => {
    expect(reverseDictValues({ userId: "id", postId: "pk" })).toMatchSnapshot();
  });

  test("should handle empty dict", () => {
    expect(reverseDictValues({})).toMatchSnapshot();
  });

  test("should handle single entry", () => {
    expect(reverseDictValues({ foreignId: "id" })).toMatchSnapshot();
  });

  test("should handle multiple entries", () => {
    expect(
      reverseDictValues({ tenantId: "id", orgId: "orgPk", userId: "userPk" }),
    ).toMatchSnapshot();
  });
});
