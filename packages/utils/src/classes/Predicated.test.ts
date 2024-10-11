import { TEST_PEOPLE } from "../__fixtures__/test-people";
import { Predicated } from "./Predicated";

describe("Predicated", () => {
  describe("filter", () => {
    test("should filter by city", () => {
      expect(Predicated.filter(TEST_PEOPLE, { address: { city: "New York" } })).toEqual([
        expect.objectContaining({ id: "1" }),
        expect.objectContaining({ id: "3" }),
      ]);
    });

    test("should filter by name", () => {
      expect(Predicated.filter(TEST_PEOPLE, { name: "John Doe" })).toEqual([
        expect.objectContaining({ id: "1" }),
      ]);
    });

    test("should filter by name and city", () => {
      expect(
        Predicated.filter(TEST_PEOPLE, {
          name: "John Doe",
          address: { city: "New York" },
        }),
      ).toEqual([expect.objectContaining({ id: "1" })]);
    });

    test("should filter by friend name", () => {
      expect(
        Predicated.filter(TEST_PEOPLE, { friends: [{ name: "Jane Black" }] }),
      ).toEqual([
        expect.objectContaining({ id: "1" }),
        expect.objectContaining({ id: "4" }),
      ]);
    });

    // Test $regex operator
    test("should filter by name using regex", () => {
      expect(Predicated.filter(TEST_PEOPLE, { name: { $regex: /^John/ } })).toEqual([
        expect.objectContaining({ id: "1" }),
      ]);
    });

    // Test $and operator
    test("should filter using $and operator", () => {
      expect(
        Predicated.filter(TEST_PEOPLE, {
          $and: [
            { name: { $eq: "John Doe" } },
            { address: { city: { $in: ["New York"] } } },
          ],
        }),
      ).toEqual([expect.objectContaining({ id: "1" })]);
    });

    // Test $or operator
    test("should filter using $or operator", () => {
      expect(
        Predicated.filter(TEST_PEOPLE, {
          $or: [{ name: { $eq: "John Doe" } }, { address: { city: { $eq: "London" } } }],
        }),
      ).toEqual([
        expect.objectContaining({ id: "1" }),
        expect.objectContaining({ id: "4" }),
      ]);
    });

    // Test $or operator
    test("should filter using deep $or operator", () => {
      expect(
        Predicated.filter(TEST_PEOPLE, {
          name: { $or: ["John Doe", { $eq: "John Doe" }, { $eq: "Alice Fisher" }] },
        }),
      ).toEqual([
        expect.objectContaining({ id: "1" }),
        expect.objectContaining({ id: "4" }),
      ]);
      Predicated.filter(TEST_PEOPLE, { name: "John Doe" });
    });

    // Test $not operator
    test("should filter using $not operator", () => {
      expect(
        Predicated.filter(TEST_PEOPLE, {
          $not: { name: { $eq: "John Doe" } },
        }),
      ).toEqual([
        expect.objectContaining({ id: "2" }),
        expect.objectContaining({ id: "3" }),
        expect.objectContaining({ id: "4" }),
      ]);
    });

    // Test age with comparison operators
    test("should filter by age using comparison operators", () => {
      expect(Predicated.filter(TEST_PEOPLE, { age: { $gte: 30 } })).toEqual([
        expect.objectContaining({ id: "1" }),
        expect.objectContaining({ id: "3" }),
      ]);
    });

    // Test date using $between operator
    test("should filter by joined date using $between operator", () => {
      expect(
        Predicated.filter(TEST_PEOPLE, {
          joinedAt: { $between: [new Date("2019-01-01"), new Date("2020-12-31")] },
        }),
      ).toEqual([
        expect.objectContaining({ id: "1" }),
        expect.objectContaining({ id: "2" }),
      ]);
    });

    // Test hobbies array with $in operator
    test("should filter by hobbies using $in operator", () => {
      expect(Predicated.filter(TEST_PEOPLE, { hobbies: { $in: ["reading"] } })).toEqual([
        expect.objectContaining({ id: "1" }),
      ]);
    });

    // Test multiple hobbies with $and and $in
    test("should filter by multiple hobbies using $and and $in operators", () => {
      expect(
        Predicated.filter(TEST_PEOPLE, {
          $and: [{ hobbies: { $in: ["reading"] } }, { hobbies: { $in: ["coding"] } }],
        }),
      ).toEqual([expect.objectContaining({ id: "1" })]);
    });

    // Test $neq operator
    test("should filter using $neq operator", () => {
      expect(Predicated.filter(TEST_PEOPLE, { name: { $neq: "John Doe" } })).toEqual([
        expect.objectContaining({ id: "2" }),
        expect.objectContaining({ id: "3" }),
        expect.objectContaining({ id: "4" }),
      ]);
    });

    // Test $gt operator (age greater than)
    test("should filter using $gt operator", () => {
      expect(Predicated.filter(TEST_PEOPLE, { age: { $gt: 30 } })).toEqual([
        expect.objectContaining({ id: "3" }),
      ]);
    });

    // Test $gte operator (age greater than)
    test("should filter using $gte operator", () => {
      expect(Predicated.filter(TEST_PEOPLE, { age: { $gte: 30 } })).toEqual([
        expect.objectContaining({ id: "1" }),
        expect.objectContaining({ id: "3" }),
      ]);
    });

    // Test $lt operator (age less than)
    test("should filter using $lt operator", () => {
      expect(Predicated.filter(TEST_PEOPLE, { age: { $lt: 28 } })).toEqual([
        expect.objectContaining({ id: "2" }),
      ]);
    });

    // Test $lte operator (age less than or equal)
    test("should filter using $lte operator", () => {
      expect(Predicated.filter(TEST_PEOPLE, { age: { $lte: 28 } })).toEqual([
        expect.objectContaining({ id: "2" }),
        expect.objectContaining({ id: "4" }),
      ]);
    });

    // Test $like operator (case-sensitive partial match)
    test("should filter using $like operator", () => {
      expect(Predicated.filter(TEST_PEOPLE, { name: { $like: "John" } })).toEqual([
        expect.objectContaining({ id: "1" }),
      ]);
    });

    // Test $ilike operator (case-insensitive partial match)
    test("should filter using $ilike operator", () => {
      expect(Predicated.filter(TEST_PEOPLE, { name: { $ilike: "john" } })).toEqual([
        expect.objectContaining({ id: "1" }),
      ]);
    });

    // Test $nin operator (not in array)
    test("should filter using $nin operator", () => {
      expect(Predicated.filter(TEST_PEOPLE, { hobbies: { $nin: ["reading"] } })).toEqual([
        expect.objectContaining({ id: "2" }),
        expect.objectContaining({ id: "3" }),
        expect.objectContaining({ id: "4" }),
      ]);
    });

    // Test for empty predicate
    test("should return all people when given an empty predicate", () => {
      expect(Predicated.filter(TEST_PEOPLE, {})).toEqual(TEST_PEOPLE);
    });

    // Test deep nested logical operators
    test("should filter using deep nested $and and $or", () => {
      expect(
        Predicated.filter(TEST_PEOPLE, {
          $or: [
            {
              $and: [
                { name: { $eq: "John Doe" } },
                { address: { city: { $eq: "New York" } } },
              ],
            },
            {
              $and: [
                { name: { $eq: "Alice Fisher" } },
                { address: { city: { $eq: "London" } } },
              ],
            },
          ],
        }),
      ).toEqual([
        expect.objectContaining({ id: "1" }),
        expect.objectContaining({ id: "4" }),
      ]);
    });

    // Test for empty $in array
    test("should return nothing for an empty $in array", () => {
      expect(Predicated.filter(TEST_PEOPLE, { name: { $in: [] } })).toEqual([]);
    });

    // Test for empty $nin array
    test("should return all people for an empty $nin array", () => {
      expect(Predicated.filter(TEST_PEOPLE, { name: { $nin: [] } })).toEqual(TEST_PEOPLE);
    });

    // Test when the field does not exist
    test("should return nothing when filtering by a non-existing field", () => {
      expect(
        Predicated.filter(TEST_PEOPLE, {
          // @ts-expect-error
          nonExistingField: { $eq: "value" },
        }),
      ).toEqual([]);
    });

    // Test for invalid types in comparison
    test("should throw when comparing incompatible types", () => {
      expect(() => Predicated.filter(TEST_PEOPLE, { name: { $gt: "30" } })).toThrow();
    });

    // Test for null values
    test("should handle null values", () => {
      expect(
        Predicated.filter(
          [
            ...TEST_PEOPLE,
            { id: "5", name: null, address: { street: null, city: "Berlin" }, age: null },
          ],
          { name: { $eq: null } },
        ),
      ).toEqual([expect.objectContaining({ id: "5" })]);
    });

    // Test deep $not operator
    test("should filter using deep $not operator", () => {
      expect(
        Predicated.filter(TEST_PEOPLE, {
          address: { city: { $not: { $eq: "New York" } } },
        }),
      ).toEqual([
        expect.objectContaining({ id: "2" }),
        expect.objectContaining({ id: "4" }),
      ]);
    });

    // Test deep $and and $or operator on multiple fields
    test("should filter using deep $and and $or operators on multiple fields", () => {
      expect(
        Predicated.filter(TEST_PEOPLE, {
          $and: [
            {
              $or: [{ name: { $eq: "John Doe" } }, { name: { $eq: "Alice Fisher" } }],
            },
            { age: { $gte: 30 } },
          ],
        }),
      ).toEqual([expect.objectContaining({ id: "1" })]);
    });

    // Test null values in deep $or
    test("should handle null values in deep $or", () => {
      expect(
        Predicated.filter(
          [
            ...TEST_PEOPLE,
            { id: "5", name: null, address: { street: "Null St", city: "Null City" } },
          ],
          { name: { $or: [null, { $eq: "Alice Fisher" }] } },
        ),
      ).toEqual([
        expect.objectContaining({ id: "4" }),
        expect.objectContaining({ id: "5" }),
      ]);
    });

    // Test for deep nested fields with logical operators
    test("should filter with deeply nested $and and $not", () => {
      expect(
        Predicated.filter(TEST_PEOPLE, {
          address: {
            city: { $not: { $eq: "New York" } },
            street: { $and: [{ $eq: "456 Elm St" }, { $not: { $eq: "789 Oak St" } }] },
          },
        }),
      ).toEqual([expect.objectContaining({ id: "2" })]);
    });

    // Test mixed logical and predicate operators
    test("should filter using $or and predicate operators", () => {
      expect(
        Predicated.filter(TEST_PEOPLE, {
          age: { $or: [{ $gte: 30 }, { $lt: 28 }] }, // Age greater than or equal to 30, or less than 28
        }),
      ).toEqual([
        expect.objectContaining({ id: "1" }), // age >= 30
        expect.objectContaining({ id: "2" }), // age < 28
        expect.objectContaining({ id: "3" }), // age >= 30
      ]);
    });

    // Test date comparison operators
    test("should filter by joined date using comparison operators", () => {
      expect(
        Predicated.filter(TEST_PEOPLE, { joinedAt: { $gt: new Date("2020-01-01") } }), // joined after 2018
      ).toEqual([expect.objectContaining({ id: "4" })]);
    });

    // Test empty $and operator
    test("should handle empty $and operator", () => {
      expect(Predicated.filter(TEST_PEOPLE, { $and: [] })).toEqual(TEST_PEOPLE); // Empty $and should match everything
    });

    // Test empty $or operator
    test("should handle empty $or operator", () => {
      expect(Predicated.filter(TEST_PEOPLE, { $or: [] })).toEqual([]); // Empty $or should match nothing
    });

    // Test empty $not operator
    test("should handle empty $not operator", () => {
      expect(Predicated.filter(TEST_PEOPLE, { $not: {} })).toEqual([]); // Empty $not should match nothing
    });

    // Test recursive matching for nested objects
    test("should filter by deep nested objects", () => {
      expect(
        Predicated.filter(TEST_PEOPLE, {
          address: { street: { $like: "Main" }, city: { $eq: "New York" } },
        }),
      ).toEqual([expect.objectContaining({ id: "1" })]);
    });

    // Test $not with array elements
    test("should filter using $not operator on arrays", () => {
      expect(
        Predicated.filter(TEST_PEOPLE, {
          hobbies: { $not: { $in: ["reading", "coding"] } },
        }),
      ).toEqual([
        expect.objectContaining({ id: "2" }),
        expect.objectContaining({ id: "3" }),
        expect.objectContaining({ id: "4" }),
      ]);
    });
  });
});
