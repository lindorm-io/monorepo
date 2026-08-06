import {
  TEST_ARRAY_WITH_OBJECTS,
  TEST_DEEP_ARRAY,
  TEST_DEEP_OBJECT,
  TEST_OBJECT,
} from "../../__fixtures__/objects.js";
import { changeKeys } from "./change-keys.js";
import { describe, expect, test } from "vitest";

describe("changeKeys depth", () => {
  test("should convert only the top level at depth 1", () => {
    expect(changeKeys(TEST_DEEP_OBJECT, "snake", { depth: 1 })).toEqual({
      grant_type: "authorization_code",
      authorization_details: [
        {
          type: "payment_initiation",
          instructedAmount: { currencyCode: "EUR", amountValue: "123.50" },
        },
      ],
    });
  });

  test("should convert every level when depth is omitted", () => {
    expect(changeKeys(TEST_DEEP_OBJECT, "snake")).toEqual({
      grant_type: "authorization_code",
      authorization_details: [
        {
          type: "payment_initiation",
          instructed_amount: { currency_code: "EUR", amount_value: "123.50" },
        },
      ],
    });
  });

  test("should keep an out-of-depth subtree verbatim by reference", () => {
    const result = changeKeys(TEST_DEEP_OBJECT, "snake", { depth: 1 }) as any;

    expect(result.authorization_details).toBe(TEST_DEEP_OBJECT.authorizationDetails);
  });

  test("should not mutate the input", () => {
    changeKeys(TEST_DEEP_OBJECT, "snake", { depth: 1 });

    expect(TEST_DEEP_OBJECT).toMatchSnapshot();
  });

  // An array is a transparent container — entering one does not spend a level,
  // so the objects it holds are converted at the depth the array was reached at.
  test("should convert the objects of a top level array at depth 1", () => {
    expect(
      changeKeys([{ firstName: "Alice" }, { firstName: "Bob" }], "snake", { depth: 1 }),
    ).toEqual([{ first_name: "Alice" }, { first_name: "Bob" }]);
  });

  test("should treat nested arrays as transparent", () => {
    expect(
      changeKeys({ outerKey: [[{ innerKey: true }]] }, "snake", { depth: 2 }),
    ).toEqual({
      outer_key: [[{ inner_key: true }]],
    });
  });

  test.each([1, 2, 3])("should convert exactly %s levels of a nested array", (depth) => {
    expect(changeKeys(TEST_DEEP_ARRAY, "snake", { depth })).toMatchSnapshot();
  });

  test("should be a no-op beyond the depth of the structure", () => {
    expect(changeKeys(TEST_DEEP_OBJECT, "snake", { depth: 99 })).toEqual(
      changeKeys(TEST_DEEP_OBJECT, "snake"),
    );
  });

  test("should accept Infinity as unlimited", () => {
    expect(changeKeys(TEST_DEEP_OBJECT, "snake", { depth: Infinity })).toEqual(
      changeKeys(TEST_DEEP_OBJECT, "snake"),
    );
  });

  test("should ignore depth for mode none", () => {
    expect(changeKeys(TEST_DEEP_OBJECT, "none", { depth: 0 })).toBe(TEST_DEEP_OBJECT);
  });

  test.each([0, -1, 1.5, NaN])("should throw for invalid depth %s", (depth) => {
    expect(() => changeKeys(TEST_DEEP_OBJECT, "snake", { depth })).toThrow(
      `Invalid depth [ ${depth} ]`,
    );
  });

  // Every existing caller passes no options — the walk must stay exactly as it was.
  test.each([TEST_OBJECT, TEST_ARRAY_WITH_OBJECTS, TEST_DEEP_OBJECT, TEST_DEEP_ARRAY])(
    "should match the unlimited walk when options are omitted",
    (input) => {
      expect(changeKeys(input, "snake", {})).toEqual(changeKeys(input, "snake"));
    },
  );
});
