import { TEST_PEOPLE } from "../__fixtures__/test-people";
import { find } from "./find";

describe("find", () => {
  test("should find by name", () => {
    expect(find(TEST_PEOPLE, { name: "John Doe" })).toEqual(
      expect.objectContaining({ id: "1" }),
    );
  });

  test("should find by name and city", () => {
    expect(
      find(TEST_PEOPLE, { name: "John Doe", address: { city: "New York" } }),
    ).toEqual(expect.objectContaining({ id: "1" }));
  });
});
