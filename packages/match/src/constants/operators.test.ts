import { describe, expect, test } from "vitest";
import type { ConditionOperator } from "../types/condition.js";
import {
  ConditionOperatorKey,
  LogicalOperatorKey,
  isConditionOperatorKey,
  isLogicalOperatorKey,
} from "./operators.js";

type AssertEqual<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;

describe("operators", () => {
  test("should declare the condition operator vocabulary", () => {
    expect(Object.values(ConditionOperatorKey)).toMatchSnapshot();
  });

  test("should declare the logical operator vocabulary", () => {
    expect(Object.values(LogicalOperatorKey)).toMatchSnapshot();
  });

  test("should declare exactly the operators the payload type declares", () => {
    // Type-level, so `npm run typecheck` fails the moment either side gains or
    // loses an operator. The artifact is the single vocabulary every
    // implementation derives from — a second, drifting list is the bug it exists
    // to prevent.
    const proof: AssertEqual<
      keyof ConditionOperator<unknown>,
      ConditionOperatorKey | LogicalOperatorKey
    > = true;

    expect(proof).toBe(true);
  });

  test("should recognise condition operator keys", () => {
    expect(isConditionOperatorKey("$eq")).toBe(true);
    expect(isConditionOperatorKey("$has")).toBe(true);
    expect(isConditionOperatorKey("$and")).toBe(false);
    expect(isConditionOperatorKey("$ne")).toBe(false);
    expect(isConditionOperatorKey("name")).toBe(false);
  });

  test("should recognise logical operator keys", () => {
    expect(isLogicalOperatorKey("$and")).toBe(true);
    expect(isLogicalOperatorKey("$or")).toBe(true);
    expect(isLogicalOperatorKey("$not")).toBe(true);
    expect(isLogicalOperatorKey("$eq")).toBe(false);
    expect(isLogicalOperatorKey("name")).toBe(false);
  });
});
