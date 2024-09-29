import { TEST_PEOPLE } from "../__fixtures__/test-people";
import { findLast } from "./find-last";

describe("findLast", () => {
  test("should findLast by city", () => {
    expect(findLast(TEST_PEOPLE, { address: { city: "New York" } })).toEqual(
      expect.objectContaining({ id: "3" }),
    );
  });

  test("should findLast by common", () => {
    expect(findLast(TEST_PEOPLE, { common: "common" })).toEqual(
      expect.objectContaining({ id: "4" }),
    );
  });

  test("should findLast and resolve undefined", () => {
    expect(findLast(TEST_PEOPLE, { name: "Something Wrong" })).toBeUndefined();
  });
});
