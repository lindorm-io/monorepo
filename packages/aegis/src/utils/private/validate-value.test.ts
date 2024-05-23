import { validateValue } from "./validate-value";

describe("validateValue", () => {
  describe("arrays", () => {
    test("should verify array using $Has", () => {
      expect(validateValue(["one"], { $has: "one" })).toEqual(true);
      expect(validateValue(["one"], { $has: "two" })).toEqual(false);
    });

    test("should verify array using $HasNot", () => {
      expect(validateValue(["one"], { $not: "two" })).toEqual(true);
      expect(validateValue(["one"], { $not: "one" })).toEqual(false);
    });

    test("should verify array using $HasAll", () => {
      expect(validateValue(["one"], { $all: ["one"] })).toEqual(true);
      expect(validateValue(["one", "two"], { $all: ["one"] })).toEqual(true);
      expect(validateValue(["one"], { $all: ["one", "two"] })).toEqual(false);
    });

    test("should verify array using $HasAny", () => {
      expect(validateValue(["one"], { $any: ["one"] })).toEqual(true);
      expect(validateValue(["one"], { $any: ["two"] })).toEqual(false);
    });

    test("should verify array using $HasNone", () => {
      expect(validateValue(["one"], { $none: ["two"] })).toEqual(true);
      expect(validateValue(["one"], { $none: ["one"] })).toEqual(false);
    });

    test("should verify array using $And", () => {
      expect(
        validateValue(["one"], {
          $and: [{ $all: ["one"] }, { $none: ["two"] }],
        }),
      ).toEqual(true);
      expect(
        validateValue(["one"], { $and: [{ $all: ["one"] }, { $any: ["two"] }] }),
      ).toEqual(false);
    });

    test("should verify array using deep $And", () => {
      expect(
        validateValue(["one"], {
          $and: [{ $all: ["one"] }, { $or: [{ $all: ["one"] }, { $any: ["two"] }] }],
        }),
      ).toEqual(true);
      expect(
        validateValue(["one"], {
          $and: [{ $all: ["one"] }, { $or: [{ $all: ["two"] }, { $any: ["two"] }] }],
        }),
      ).toEqual(false);
    });

    test("should verify array using $Or", () => {
      expect(
        validateValue(["one"], { $or: [{ $all: ["one"] }, { $any: ["two"] }] }),
      ).toEqual(true);
      expect(
        validateValue(["one"], { $or: [{ $all: ["two"] }, { $any: ["two"] }] }),
      ).toEqual(false);
    });

    test("should verify array using deep $Or", () => {
      expect(
        validateValue(["one"], {
          $or: [{ $all: ["two"] }, { $and: [{ $all: ["one"] }, { $any: ["one"] }] }],
        }),
      ).toEqual(true);
      expect(
        validateValue(["one"], {
          $or: [{ $all: ["two"] }, { $and: [{ $all: ["two"] }, { $any: ["two"] }] }],
        }),
      ).toEqual(false);
    });
  });

  describe("numbers", () => {
    test("should verify number using $Equals", () => {
      expect(validateValue(1, { $eq: 1 })).toEqual(true);
      expect(validateValue(1, { $eq: 2 })).toEqual(false);
    });

    test("should verify number using $NotEquals", () => {
      expect(validateValue(1, { $ne: 2 })).toEqual(true);
      expect(validateValue(1, { $ne: 1 })).toEqual(false);
    });

    test("should verify number using $In", () => {
      expect(validateValue(1, { $in: [1] })).toEqual(true);
      expect(validateValue(1, { $in: [2] })).toEqual(false);
    });

    test("should verify number using $NotIn", () => {
      expect(validateValue(1, { $nin: [2] })).toEqual(true);
      expect(validateValue(1, { $nin: [1] })).toEqual(false);
    });

    test("should verify number using $And", () => {
      expect(validateValue(1, { $and: [{ $eq: 1 }, { $ne: 2 }] })).toEqual(true);
      expect(validateValue(1, { $and: [{ $eq: 1 }, { $eq: 2 }] })).toEqual(false);
    });

    test("should verify number using deep $And", () => {
      expect(
        validateValue(1, {
          $and: [{ $eq: 1 }, { $or: [{ $eq: 1 }, { $eq: 2 }] }],
        }),
      ).toEqual(true);
      expect(
        validateValue(1, {
          $and: [{ $eq: 1 }, { $or: [{ $eq: 2 }, { $eq: 2 }] }],
        }),
      ).toEqual(false);
    });

    test("should verify number using $Or", () => {
      expect(validateValue(1, { $or: [{ $eq: 1 }, { $eq: 2 }] })).toEqual(true);
      expect(validateValue(1, { $or: [{ $eq: 2 }, { $eq: 2 }] })).toEqual(false);
    });

    test("should verify number using deep $Or", () => {
      expect(
        validateValue(1, {
          $or: [{ $eq: 2 }, { $and: [{ $eq: 1 }, { $ne: 2 }] }],
        }),
      ).toEqual(true);
      expect(
        validateValue(1, {
          $or: [{ $eq: 2 }, { $and: [{ $eq: 2 }, { $eq: 2 }] }],
        }),
      ).toEqual(false);
    });
  });

  describe("dates", () => {
    const yesterday = new Date("2024-01-01T00:00:00.000Z");
    const today = new Date("2024-01-02T00:00:00.000Z");
    const tomorrow = new Date("2024-01-03T00:00:00.000Z");

    test("should verify date using $Equals", () => {
      expect(validateValue(today, { $eq: yesterday })).toEqual(false);
      expect(validateValue(today, { $eq: today })).toEqual(true);
      expect(validateValue(today, { $eq: tomorrow })).toEqual(false);
    });

    test("should verify date using $NotEquals", () => {
      expect(validateValue(today, { $ne: yesterday })).toEqual(true);
      expect(validateValue(today, { $ne: today })).toEqual(false);
      expect(validateValue(today, { $ne: tomorrow })).toEqual(true);
    });

    test("should verify date using $Before", () => {
      expect(validateValue(today, { $before: yesterday })).toEqual(false);
      expect(validateValue(today, { $before: today })).toEqual(false);
      expect(validateValue(today, { $before: tomorrow })).toEqual(true);
    });

    test("should verify date using $BeforeOrEquals", () => {
      expect(validateValue(today, { $beforeOrEq: tomorrow })).toEqual(true);
      expect(validateValue(today, { $beforeOrEq: today })).toEqual(true);
      expect(validateValue(today, { $beforeOrEq: yesterday })).toEqual(false);
    });

    test("should verify date using $After", () => {
      expect(validateValue(today, { $after: yesterday })).toEqual(true);
      expect(validateValue(today, { $after: today })).toEqual(false);
      expect(validateValue(today, { $after: tomorrow })).toEqual(false);
    });

    test("should verify date using $AfterOrEquals", () => {
      expect(validateValue(today, { $afterOrEq: yesterday })).toEqual(true);
      expect(validateValue(today, { $afterOrEq: today })).toEqual(true);
      expect(validateValue(today, { $afterOrEq: tomorrow })).toEqual(false);
    });

    test("should verify date using $And", () => {
      expect(
        validateValue(today, {
          $and: [{ $eq: today }, { $ne: tomorrow }],
        }),
      ).toEqual(true);
      expect(
        validateValue(today, {
          $and: [{ $eq: today }, { $eq: tomorrow }],
        }),
      ).toEqual(false);
    });

    test("should verify date using deep $And", () => {
      expect(
        validateValue(today, {
          $and: [{ $eq: today }, { $or: [{ $eq: today }, { $ne: today }] }],
        }),
      ).toEqual(true);
      expect(
        validateValue(today, {
          $and: [{ $eq: tomorrow }, { $or: [{ $eq: today }, { $ne: today }] }],
        }),
      ).toEqual(false);
    });

    test("should verify date using $Or", () => {
      expect(
        validateValue(today, {
          $or: [{ $eq: today }, { $eq: tomorrow }],
        }),
      ).toEqual(true);
      expect(
        validateValue(today, {
          $or: [{ $eq: tomorrow }, { $eq: tomorrow }],
        }),
      ).toEqual(false);
    });

    test("should verify date using deep $Or", () => {
      expect(
        validateValue(today, {
          $or: [{ $eq: today }, { $and: [{ $eq: tomorrow }, { $ne: today }] }],
        }),
      ).toEqual(true);
      expect(
        validateValue(today, {
          $or: [{ $eq: tomorrow }, { $and: [{ $eq: today }, { $ne: today }] }],
        }),
      ).toEqual(false);
    });
  });

  describe("strings", () => {
    test("should verify string using $Equals", () => {
      expect(validateValue("one", { $eq: "one" })).toEqual(true);
      expect(validateValue("one", { $eq: "two" })).toEqual(false);
    });

    test("should verify string using $NotEquals", () => {
      expect(validateValue("one", { $ne: "two" })).toEqual(true);
      expect(validateValue("one", { $ne: "one" })).toEqual(false);
    });

    test("should verify string using $In", () => {
      expect(validateValue("one", { $in: ["one"] })).toEqual(true);
      expect(validateValue("one", { $in: ["two"] })).toEqual(false);
    });

    test("should verify string using $NotIn", () => {
      expect(validateValue("one", { $nin: ["two"] })).toEqual(true);
      expect(validateValue("one", { $nin: ["one"] })).toEqual(false);
    });

    test("should verify string using $Regex", () => {
      expect(validateValue("one", { $regex: "^one$" })).toEqual(true);
      expect(validateValue("one", { $regex: "^two$" })).toEqual(false);
    });

    test("should verify string using $And", () => {
      expect(validateValue("one", { $and: [{ $eq: "one" }, { $ne: "two" }] })).toEqual(
        true,
      );
      expect(validateValue("one", { $and: [{ $eq: "one" }, { $eq: "two" }] })).toEqual(
        false,
      );
    });

    test("should verify string using deep $And", () => {
      expect(
        validateValue("one", {
          $and: [{ $eq: "one" }, { $or: [{ $eq: "one" }, { $eq: "two" }] }],
        }),
      ).toEqual(true);
      expect(
        validateValue("one", {
          $and: [{ $eq: "one" }, { $or: [{ $eq: "two" }, { $eq: "two" }] }],
        }),
      ).toEqual(false);
    });

    test("should verify string using $Or", () => {
      expect(validateValue("one", { $or: [{ $eq: "one" }, { $eq: "two" }] })).toEqual(
        true,
      );
      expect(validateValue("one", { $or: [{ $eq: "two" }, { $eq: "two" }] })).toEqual(
        false,
      );
    });

    test("should verify string using deep $Or", () => {
      expect(
        validateValue("one", {
          $or: [{ $eq: "two" }, { $and: [{ $eq: "one" }, { $ne: "two" }] }],
        }),
      ).toEqual(true);
      expect(
        validateValue("one", {
          $or: [{ $eq: "two" }, { $and: [{ $eq: "two" }, { $eq: "two" }] }],
        }),
      ).toEqual(false);
    });
  });
});
