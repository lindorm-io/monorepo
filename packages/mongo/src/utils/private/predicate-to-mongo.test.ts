import { Predicate } from "@lindorm/types";
import { predicateToMongo } from "./predicate-to-mongo";

describe("predicateToMongo", () => {
  test("should convert $eq operator", () => {
    const predicate: Predicate<any> = { name: { $eq: "John" } };
    expect(predicateToMongo(predicate)).toEqual({ name: { $eq: "John" } });
  });

  test("should convert $neq operator", () => {
    const predicate: Predicate<any> = { age: { $neq: 30 } };
    expect(predicateToMongo(predicate)).toEqual({ age: { $ne: 30 } });
  });

  test("should convert $gt, $lt, $gte, $lte", () => {
    const predicate: Predicate<any> = {
      age: { $gt: 20, $lt: 40, $gte: 21, $lte: 39 },
    };
    expect(predicateToMongo(predicate)).toEqual({
      age: { $gt: 20, $lt: 40, $gte: 21, $lte: 39 },
    });
  });

  test("should convert $between to $gte and $lte", () => {
    const predicate: Predicate<any> = {
      age: { $between: [30, 40] },
    };
    expect(predicateToMongo(predicate)).toEqual({
      age: { $gte: 30, $lte: 40 },
    });
  });

  test("should convert $like and $ilike to $regex", () => {
    expect(predicateToMongo({ name: { $like: "John" } })).toEqual({
      name: { $regex: /John/ },
    });

    expect(predicateToMongo({ name: { $ilike: "john" } })).toEqual({
      name: { $regex: /john/i },
    });
  });

  test("should convert $in and $nin", () => {
    const predicate: Predicate<any> = {
      age: { $in: [25, 30] },
      name: { $nin: ["Eve", "Frank"] },
    };
    expect(predicateToMongo(predicate)).toEqual({
      age: { $in: [25, 30] },
      name: { $nin: ["Eve", "Frank"] },
    });
  });

  test("should convert $all", () => {
    const predicate: Predicate<any> = {
      tags: { $all: ["a", "b"] },
    };
    expect(predicateToMongo(predicate)).toEqual({
      tags: { $all: ["a", "b"] },
    });
  });

  test("should convert $length to $size", () => {
    const predicate: Predicate<any> = {
      hobbies: { $length: 3 },
    };
    expect(predicateToMongo(predicate)).toEqual({
      hobbies: { $size: 3 },
    });
  });

  test("should convert $mod", () => {
    const predicate: Predicate<any> = {
      age: { $mod: [2, 0] },
    };
    expect(predicateToMongo(predicate)).toEqual({
      age: { $mod: [2, 0] },
    });
  });

  test("should convert logical operators", () => {
    const predicate: Predicate<any> = {
      $and: [
        { name: { $eq: "Alice" } },
        { age: { $gte: 18 } },
        { tags: { $all: ["admin"] } },
      ],
    };
    expect(predicateToMongo(predicate)).toEqual({
      $and: [
        { name: { $eq: "Alice" } },
        { age: { $gte: 18 } },
        { tags: { $all: ["admin"] } },
      ],
    });
  });

  test("should handle $not with inner predicate", () => {
    const predicate: Predicate<any> = {
      name: { $not: { $eq: "Eve" } },
    };
    expect(predicateToMongo(predicate)).toEqual({
      name: { $not: { $eq: "Eve" } },
    });
  });

  test("should handle deep nesting", () => {
    const predicate: Predicate<any> = {
      user: {
        name: { $eq: "John" },
        roles: { $all: ["admin", "user"] },
      },
    };
    expect(predicateToMongo(predicate)).toEqual({
      user: {
        name: { $eq: "John" },
        roles: { $all: ["admin", "user"] },
      },
    });
  });

  test("should convert $and with direct values", () => {
    const predicate: Predicate<any> = {
      name: { $and: ["John", { $eq: "John" }] },
    };
    expect(predicateToMongo(predicate)).toEqual({
      name: { $and: [{ $eq: "John" }, { $eq: "John" }] },
    });
  });

  test("should convert $not at root level", () => {
    const predicate: Predicate<any> = {
      $not: {
        name: { $eq: "John" },
      },
    };
    expect(predicateToMongo(predicate)).toEqual({
      $not: {
        name: { $eq: "John" },
      },
    });
  });
});
