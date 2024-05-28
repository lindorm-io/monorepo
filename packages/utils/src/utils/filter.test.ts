import { TEST_PEOPLE } from "../__fixtures__/test-people";
import { filter } from "./filter";

describe("filter", () => {
  test("should filter by city", () => {
    expect(filter(TEST_PEOPLE, { address: { city: "New York" } })).toEqual([
      expect.objectContaining({ id: "1" }),
      expect.objectContaining({ id: "3" }),
    ]);
  });

  test("should filter by name", () => {
    expect(filter(TEST_PEOPLE, { name: "John Doe" })).toEqual([
      expect.objectContaining({ id: "1" }),
    ]);
  });

  test("should filter by name and city", () => {
    expect(
      filter(TEST_PEOPLE, { name: "John Doe", address: { city: "New York" } }),
    ).toEqual([expect.objectContaining({ id: "1" })]);
  });

  test("should filter by friend name", () => {
    expect(filter(TEST_PEOPLE, { friends: [{ name: "Jane Black" }] })).toEqual([
      expect.objectContaining({ id: "1" }),
      expect.objectContaining({ id: "4" }),
    ]);
  });
});
