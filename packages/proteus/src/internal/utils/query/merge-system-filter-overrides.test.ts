import { describe, expect, test } from "vitest";
import {
  SCOPE_FILTER_NAME,
  SOFT_DELETE_FILTER_NAME,
} from "../../entity/metadata/auto-filters";
import { mergeSystemFilterOverrides } from "./merge-system-filter-overrides";

describe("mergeSystemFilterOverrides", () => {
  test("should return undefined when withDeleted is false, withoutScope is false, and no request overrides", () => {
    expect(mergeSystemFilterOverrides(undefined, false)).toBeUndefined();
  });

  test("should pass through request overrides when neither flag is set", () => {
    const overrides = { myFilter: true };
    expect(mergeSystemFilterOverrides(overrides, false)).toBe(overrides);
  });

  test("should add __softDelete: false when withDeleted is true", () => {
    const result = mergeSystemFilterOverrides(undefined, true);

    expect(result).toEqual({
      [SOFT_DELETE_FILTER_NAME]: false,
    });
  });

  test("should merge __softDelete: false with existing request overrides", () => {
    const overrides = { myFilter: true, anotherFilter: { param: "value" } };
    const result = mergeSystemFilterOverrides(overrides, true);

    expect(result).toEqual({
      myFilter: true,
      anotherFilter: { param: "value" },
      [SOFT_DELETE_FILTER_NAME]: false,
    });
  });

  test("should override explicit __softDelete in request overrides when withDeleted is true", () => {
    const overrides = { [SOFT_DELETE_FILTER_NAME]: true };
    const result = mergeSystemFilterOverrides(overrides, true);

    // withDeleted: true should always win
    expect(result).toEqual({
      [SOFT_DELETE_FILTER_NAME]: false,
    });
  });

  test("should not modify the original overrides object", () => {
    const overrides = { myFilter: true };
    mergeSystemFilterOverrides(overrides, true);

    expect(overrides).toEqual({ myFilter: true });
  });
});

describe("mergeSystemFilterOverrides — withoutScope", () => {
  test("should add __scope: false when withoutScope is true", () => {
    const result = mergeSystemFilterOverrides(undefined, false, true);

    expect(result).toEqual({
      [SCOPE_FILTER_NAME]: false,
    });
  });

  test("should merge __scope: false with existing request overrides", () => {
    const overrides = { myFilter: true };
    const result = mergeSystemFilterOverrides(overrides, false, true);

    expect(result).toEqual({
      myFilter: true,
      [SCOPE_FILTER_NAME]: false,
    });
  });

  test("should combine withDeleted and withoutScope", () => {
    const result = mergeSystemFilterOverrides(undefined, true, true);

    expect(result).toEqual({
      [SOFT_DELETE_FILTER_NAME]: false,
      [SCOPE_FILTER_NAME]: false,
    });
  });

  test("should combine withDeleted, withoutScope, and existing overrides", () => {
    const overrides = { customFilter: { key: "value" } };
    const result = mergeSystemFilterOverrides(overrides, true, true);

    expect(result).toEqual({
      customFilter: { key: "value" },
      [SOFT_DELETE_FILTER_NAME]: false,
      [SCOPE_FILTER_NAME]: false,
    });
  });

  test("should override explicit __scope in request overrides when withoutScope is true", () => {
    const overrides = { [SCOPE_FILTER_NAME]: true };
    const result = mergeSystemFilterOverrides(overrides, false, true);

    expect(result).toEqual({
      [SCOPE_FILTER_NAME]: false,
    });
  });

  test("should return undefined when withoutScope is false and withDeleted is false", () => {
    expect(mergeSystemFilterOverrides(undefined, false, false)).toBeUndefined();
  });

  test("should not modify original overrides when withoutScope is true", () => {
    const overrides = { myFilter: true };
    mergeSystemFilterOverrides(overrides, false, true);

    expect(overrides).toEqual({ myFilter: true });
  });
});
