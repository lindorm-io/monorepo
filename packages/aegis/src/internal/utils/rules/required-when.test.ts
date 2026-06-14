import { describe, expect, test } from "vitest";
import { requiredWhen } from "./required-when.js";

const rules = [{ claim: "at_hash", when: (_c: any, ctx: any) => ctx.co === true }];

describe("requiredWhen", () => {
  test("no entry when the predicate is false", () => {
    expect(requiredWhen({}, { co: false }, rules)).toEqual([]);
  });

  test("no entry when the claim is already present", () => {
    expect(requiredWhen({ at_hash: "h" }, { co: true }, rules)).toEqual([]);
  });

  test("entry when the predicate is true and the claim is missing", () => {
    expect(requiredWhen({}, { co: true }, rules)).toMatchSnapshot();
  });
});
