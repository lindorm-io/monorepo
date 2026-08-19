import { describe, expect, test } from "vitest";
import { capture, errorShape, metadataOf } from "../__fixtures__/test-helpers.js";
import { GherkinError } from "../errors/GherkinError.js";
import { INJECTS_METADATA } from "../internal/metadata/symbols.js";
import { Inject } from "./Inject.js";

class AesContext {}
class KeyContext {}

describe("Inject", () => {
  test("should stage the field name and token in declaration order", () => {
    class Steps {
      @Inject(AesContext)
      aes!: AesContext;

      @Inject(KeyContext)
      keys!: KeyContext;
    }

    expect(metadataOf(Steps)[INJECTS_METADATA]).toEqual([
      { fieldName: "aes", token: AesContext },
      { fieldName: "keys", token: KeyContext },
    ]);
  });

  test("should throw scope_violation for a static field at decoration time", () => {
    const error = capture(() => {
      class Bad {
        @Inject(AesContext)
        static bad: AesContext;
      }
      return Bad;
    });

    expect(error).toEqual(expect.any(GherkinError));
    expect(error.code).toEqual("scope_violation");
    expect(error.data).toEqual({ field: "bad" });
    expect(errorShape(error)).toMatchSnapshot();
  });

  test("should throw duplicate_inject when @Inject is applied twice to one field", () => {
    const error = capture(() => {
      class Bad {
        @Inject(AesContext)
        @Inject(KeyContext)
        twice!: AesContext;
      }
      return Bad;
    });

    expect(error).toEqual(expect.any(GherkinError));
    expect(error.code).toEqual("duplicate_inject");
    expect(error.data).toEqual({ field: "twice" });
    expect(errorShape(error)).toMatchSnapshot();
  });
});
