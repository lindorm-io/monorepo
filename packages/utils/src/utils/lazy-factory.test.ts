import { lazyFactory } from "./lazy-factory.js";
import { describe, expect, test, vi } from "vitest";

describe("lazyFactory", () => {
  test("should not call factory until property is accessed", () => {
    const factory = vi.fn().mockReturnValue("value");
    const obj: Record<string, unknown> = {};

    lazyFactory(obj, "key", factory);

    expect(factory).not.toHaveBeenCalled();
  });

  test("should call factory on first access", () => {
    const factory = vi.fn().mockReturnValue("value");
    const obj: Record<string, unknown> = {};

    lazyFactory(obj, "key", factory);

    expect(obj.key).toBe("value");
    expect(factory).toHaveBeenCalledTimes(1);
  });

  test("should cache the result on subsequent accesses", () => {
    const factory = vi.fn().mockReturnValue({ data: 42 });
    const obj: Record<string, unknown> = {};

    lazyFactory(obj, "key", factory);

    const first = obj.key;
    const second = obj.key;

    expect(first).toBe(second);
    expect(factory).toHaveBeenCalledTimes(1);
  });

  test("should work with multiple properties on the same object", () => {
    const obj: Record<string, unknown> = {};

    lazyFactory(obj, "a", () => "alpha");
    lazyFactory(obj, "b", () => "beta");

    expect(obj.a).toBe("alpha");
    expect(obj.b).toBe("beta");
  });

  test("should be enumerable", () => {
    const obj: Record<string, unknown> = {};

    lazyFactory(obj, "key", () => "value");

    expect(Object.keys(obj)).toEqual(["key"]);
  });
});
