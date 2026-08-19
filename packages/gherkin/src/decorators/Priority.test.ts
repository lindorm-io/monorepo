import { describe, expect, test } from "vitest";
import { capture, errorShape, metadataOf } from "../__fixtures__/test-helpers.js";
import { GherkinError } from "../errors/GherkinError.js";
import { PRIORITIES_METADATA } from "../internal/metadata/symbols.js";
import { Priority } from "./Priority.js";

describe("Priority", () => {
  test("should stage under the compound key so a static and an instance method of the same name do not collide", () => {
    // Both legal per the lifetime rule — @BeforeFeature static, @BeforeScenario
    // instance — and both stage into ONE shared metadata bag.
    class Hooks {
      @Priority(1)
      static setup(): void {}

      @Priority(999)
      setup(): void {}
    }

    expect(metadataOf(Hooks)[PRIORITIES_METADATA]).toEqual([
      { key: "true:setup", methodName: "setup", priority: 1, static: true },
      { key: "false:setup", methodName: "setup", priority: 999, static: false },
    ]);
  });

  test("should throw invalid_priority for a non-finite priority at decoration time", () => {
    for (const priority of [
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
    ]) {
      const error = capture(() => {
        class Bad {
          @Priority(priority)
          seed(): void {}
        }
        return Bad;
      });

      expect(error).toEqual(expect.any(GherkinError));
      expect(error.code).toEqual("invalid_priority");
      expect(error.data).toEqual({ method: "seed", priority, static: false });
    }
  });

  test("should throw duplicate_priority when @Priority is applied twice to one method", () => {
    const error = capture(() => {
      class Bad {
        @Priority(1)
        @Priority(2)
        seed(): void {}
      }
      return Bad;
    });

    expect(error).toEqual(expect.any(GherkinError));
    expect(error.code).toEqual("duplicate_priority");
    expect(error.data).toEqual({ method: "seed", static: false });
    expect(errorShape(error)).toMatchSnapshot();
  });
});
