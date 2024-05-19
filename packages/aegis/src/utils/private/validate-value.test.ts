import { _validateValue } from "./validate-value";

describe("validateValue", () => {
  describe("arrays", () => {
    test("should verify array using $Has", () => {
      expect(_validateValue(["one"], { $has: "one" })).toEqual(true);
      expect(_validateValue(["one"], { $has: "two" })).toEqual(false);
    });

    test("should verify array using $HasNot", () => {
      expect(_validateValue(["one"], { $not: "two" })).toEqual(true);
      expect(_validateValue(["one"], { $not: "one" })).toEqual(false);
    });

    test("should verify array using $HasAll", () => {
      expect(_validateValue(["one"], { $all: ["one"] })).toEqual(true);
      expect(_validateValue(["one", "two"], { $all: ["one"] })).toEqual(true);
      expect(_validateValue(["one"], { $all: ["one", "two"] })).toEqual(false);
    });

    test("should verify array using $HasAny", () => {
      expect(_validateValue(["one"], { $any: ["one"] })).toEqual(true);
      expect(_validateValue(["one"], { $any: ["two"] })).toEqual(false);
    });

    test("should verify array using $HasNone", () => {
      expect(_validateValue(["one"], { $none: ["two"] })).toEqual(true);
      expect(_validateValue(["one"], { $none: ["one"] })).toEqual(false);
    });

    test("should verify array using $And", () => {
      expect(
        _validateValue(["one"], {
          $and: [{ $all: ["one"] }, { $none: ["two"] }],
        }),
      ).toEqual(true);
      expect(
        _validateValue(["one"], { $and: [{ $all: ["one"] }, { $any: ["two"] }] }),
      ).toEqual(false);
    });

    test("should verify array using deep $And", () => {
      expect(
        _validateValue(["one"], {
          $and: [{ $all: ["one"] }, { $or: [{ $all: ["one"] }, { $any: ["two"] }] }],
        }),
      ).toEqual(true);
      expect(
        _validateValue(["one"], {
          $and: [{ $all: ["one"] }, { $or: [{ $all: ["two"] }, { $any: ["two"] }] }],
        }),
      ).toEqual(false);
    });

    test("should verify array using $Or", () => {
      expect(
        _validateValue(["one"], { $or: [{ $all: ["one"] }, { $any: ["two"] }] }),
      ).toEqual(true);
      expect(
        _validateValue(["one"], { $or: [{ $all: ["two"] }, { $any: ["two"] }] }),
      ).toEqual(false);
    });

    test("should verify array using deep $Or", () => {
      expect(
        _validateValue(["one"], {
          $or: [{ $all: ["two"] }, { $and: [{ $all: ["one"] }, { $any: ["one"] }] }],
        }),
      ).toEqual(true);
      expect(
        _validateValue(["one"], {
          $or: [{ $all: ["two"] }, { $and: [{ $all: ["two"] }, { $any: ["two"] }] }],
        }),
      ).toEqual(false);
    });
  });

  describe("numbers", () => {
    test("should verify number using $Equals", () => {
      expect(_validateValue(1, { $eq: 1 })).toEqual(true);
      expect(_validateValue(1, { $eq: 2 })).toEqual(false);
    });

    test("should verify number using $NotEquals", () => {
      expect(_validateValue(1, { $ne: 2 })).toEqual(true);
      expect(_validateValue(1, { $ne: 1 })).toEqual(false);
    });

    test("should verify number using $In", () => {
      expect(_validateValue(1, { $in: [1] })).toEqual(true);
      expect(_validateValue(1, { $in: [2] })).toEqual(false);
    });

    test("should verify number using $NotIn", () => {
      expect(_validateValue(1, { $nin: [2] })).toEqual(true);
      expect(_validateValue(1, { $nin: [1] })).toEqual(false);
    });

    test("should verify number using $And", () => {
      expect(_validateValue(1, { $and: [{ $eq: 1 }, { $ne: 2 }] })).toEqual(true);
      expect(_validateValue(1, { $and: [{ $eq: 1 }, { $eq: 2 }] })).toEqual(false);
    });

    test("should verify number using deep $And", () => {
      expect(
        _validateValue(1, {
          $and: [{ $eq: 1 }, { $or: [{ $eq: 1 }, { $eq: 2 }] }],
        }),
      ).toEqual(true);
      expect(
        _validateValue(1, {
          $and: [{ $eq: 1 }, { $or: [{ $eq: 2 }, { $eq: 2 }] }],
        }),
      ).toEqual(false);
    });

    test("should verify number using $Or", () => {
      expect(_validateValue(1, { $or: [{ $eq: 1 }, { $eq: 2 }] })).toEqual(true);
      expect(_validateValue(1, { $or: [{ $eq: 2 }, { $eq: 2 }] })).toEqual(false);
    });

    test("should verify number using deep $Or", () => {
      expect(
        _validateValue(1, {
          $or: [{ $eq: 2 }, { $and: [{ $eq: 1 }, { $ne: 2 }] }],
        }),
      ).toEqual(true);
      expect(
        _validateValue(1, {
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
      expect(_validateValue(today, { $eq: yesterday })).toEqual(false);
      expect(_validateValue(today, { $eq: today })).toEqual(true);
      expect(_validateValue(today, { $eq: tomorrow })).toEqual(false);
    });

    test("should verify date using $NotEquals", () => {
      expect(_validateValue(today, { $ne: yesterday })).toEqual(true);
      expect(_validateValue(today, { $ne: today })).toEqual(false);
      expect(_validateValue(today, { $ne: tomorrow })).toEqual(true);
    });

    test("should verify date using $Before", () => {
      expect(_validateValue(today, { $before: yesterday })).toEqual(false);
      expect(_validateValue(today, { $before: today })).toEqual(false);
      expect(_validateValue(today, { $before: tomorrow })).toEqual(true);
    });

    test("should verify date using $BeforeOrEquals", () => {
      expect(_validateValue(today, { $beforeOrEq: tomorrow })).toEqual(true);
      expect(_validateValue(today, { $beforeOrEq: today })).toEqual(true);
      expect(_validateValue(today, { $beforeOrEq: yesterday })).toEqual(false);
    });

    test("should verify date using $After", () => {
      expect(_validateValue(today, { $after: yesterday })).toEqual(true);
      expect(_validateValue(today, { $after: today })).toEqual(false);
      expect(_validateValue(today, { $after: tomorrow })).toEqual(false);
    });

    test("should verify date using $AfterOrEquals", () => {
      expect(_validateValue(today, { $afterOrEq: yesterday })).toEqual(true);
      expect(_validateValue(today, { $afterOrEq: today })).toEqual(true);
      expect(_validateValue(today, { $afterOrEq: tomorrow })).toEqual(false);
    });

    test("should verify date using $And", () => {
      expect(
        _validateValue(today, {
          $and: [{ $eq: today }, { $ne: tomorrow }],
        }),
      ).toEqual(true);
      expect(
        _validateValue(today, {
          $and: [{ $eq: today }, { $eq: tomorrow }],
        }),
      ).toEqual(false);
    });

    test("should verify date using deep $And", () => {
      expect(
        _validateValue(today, {
          $and: [{ $eq: today }, { $or: [{ $eq: today }, { $ne: today }] }],
        }),
      ).toEqual(true);
      expect(
        _validateValue(today, {
          $and: [{ $eq: tomorrow }, { $or: [{ $eq: today }, { $ne: today }] }],
        }),
      ).toEqual(false);
    });

    test("should verify date using $Or", () => {
      expect(
        _validateValue(today, {
          $or: [{ $eq: today }, { $eq: tomorrow }],
        }),
      ).toEqual(true);
      expect(
        _validateValue(today, {
          $or: [{ $eq: tomorrow }, { $eq: tomorrow }],
        }),
      ).toEqual(false);
    });

    test("should verify date using deep $Or", () => {
      expect(
        _validateValue(today, {
          $or: [{ $eq: today }, { $and: [{ $eq: tomorrow }, { $ne: today }] }],
        }),
      ).toEqual(true);
      expect(
        _validateValue(today, {
          $or: [{ $eq: tomorrow }, { $and: [{ $eq: today }, { $ne: today }] }],
        }),
      ).toEqual(false);
    });
  });

  describe("strings", () => {
    test("should verify string using $Equals", () => {
      expect(_validateValue("one", { $eq: "one" })).toEqual(true);
      expect(_validateValue("one", { $eq: "two" })).toEqual(false);
    });

    test("should verify string using $NotEquals", () => {
      expect(_validateValue("one", { $ne: "two" })).toEqual(true);
      expect(_validateValue("one", { $ne: "one" })).toEqual(false);
    });

    test("should verify string using $In", () => {
      expect(_validateValue("one", { $in: ["one"] })).toEqual(true);
      expect(_validateValue("one", { $in: ["two"] })).toEqual(false);
    });

    test("should verify string using $NotIn", () => {
      expect(_validateValue("one", { $nin: ["two"] })).toEqual(true);
      expect(_validateValue("one", { $nin: ["one"] })).toEqual(false);
    });

    test("should verify string using $Regex", () => {
      expect(_validateValue("one", { $regex: "^one$" })).toEqual(true);
      expect(_validateValue("one", { $regex: "^two$" })).toEqual(false);
    });

    test("should verify string using $And", () => {
      expect(_validateValue("one", { $and: [{ $eq: "one" }, { $ne: "two" }] })).toEqual(
        true,
      );
      expect(_validateValue("one", { $and: [{ $eq: "one" }, { $eq: "two" }] })).toEqual(
        false,
      );
    });

    test("should verify string using deep $And", () => {
      expect(
        _validateValue("one", {
          $and: [{ $eq: "one" }, { $or: [{ $eq: "one" }, { $eq: "two" }] }],
        }),
      ).toEqual(true);
      expect(
        _validateValue("one", {
          $and: [{ $eq: "one" }, { $or: [{ $eq: "two" }, { $eq: "two" }] }],
        }),
      ).toEqual(false);
    });

    test("should verify string using $Or", () => {
      expect(_validateValue("one", { $or: [{ $eq: "one" }, { $eq: "two" }] })).toEqual(
        true,
      );
      expect(_validateValue("one", { $or: [{ $eq: "two" }, { $eq: "two" }] })).toEqual(
        false,
      );
    });

    test("should verify string using deep $Or", () => {
      expect(
        _validateValue("one", {
          $or: [{ $eq: "two" }, { $and: [{ $eq: "one" }, { $ne: "two" }] }],
        }),
      ).toEqual(true);
      expect(
        _validateValue("one", {
          $or: [{ $eq: "two" }, { $and: [{ $eq: "two" }, { $eq: "two" }] }],
        }),
      ).toEqual(false);
    });
  });
});
