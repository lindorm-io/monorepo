import { ParameterType as CucumberParameterType } from "@cucumber/cucumber-expressions";
import { describe, expect, test } from "vitest";
import { capture, errorShape, metadataOf } from "../__fixtures__/test-helpers.js";
import { GherkinError } from "../errors/GherkinError.js";
import type { StagedParameterType } from "../internal/metadata/staged.js";
import { PARAMETER_TYPES_METADATA } from "../internal/metadata/symbols.js";
import { ParameterType } from "./ParameterType.js";

describe("ParameterType", () => {
  test("should stage name, regexp, options, method name and the transform function", () => {
    class Transforms {
      @ParameterType("algorithm", /[A-Za-z0-9-]+/)
      static algorithm(raw: string): string {
        return raw;
      }

      @ParameterType("encryption", [/[A-Z0-9-]+/, /[a-z0-9-]+/], {
        useForSnippets: true,
      })
      static encryption(raw: string): string {
        return raw;
      }
    }

    const staged = metadataOf(Transforms)[
      PARAMETER_TYPES_METADATA
    ] as Array<StagedParameterType>;

    expect(staged).toEqual([
      {
        methodName: "algorithm",
        name: "algorithm",
        options: {},
        regexp: /[A-Za-z0-9-]+/,
        transform: expect.any(Function),
      },
      {
        methodName: "encryption",
        name: "encryption",
        options: { useForSnippets: true },
        regexp: [/[A-Z0-9-]+/, /[a-z0-9-]+/],
        transform: expect.any(Function),
      },
    ]);
    expect(staged[0].transform("raw")).toEqual("raw");
  });

  test("should throw scope_violation for an instance method at decoration time", () => {
    const error = capture(() => {
      class Bad {
        @ParameterType("algorithm", /[A-Za-z0-9-]+/)
        algorithm(raw: string): string {
          return raw;
        }
      }
      return Bad;
    });

    expect(error).toEqual(expect.any(GherkinError));
    expect(error.code).toEqual("scope_violation");
    expect(errorShape(error)).toMatchSnapshot();
  });

  test("should throw invalid_parameter_type for an empty name at decoration time", () => {
    const error = capture(() => {
      class Bad {
        @ParameterType("", /\w+/)
        static anonymous(raw: string): string {
          return raw;
        }
      }
      return Bad;
    });

    expect(error).toEqual(expect.any(GherkinError));
    expect(error.code).toEqual("invalid_parameter_type");
    expect(error.data).toEqual({ method: "anonymous", name: "" });
    expect(errorShape(error)).toMatchSnapshot();
  });

  test("should throw invalid_parameter_type for an illegal name character at decoration time", () => {
    const error = capture(() => {
      class Bad {
        @ParameterType("bad.name", /\w+/)
        static bad(raw: string): string {
          return raw;
        }
      }
      return Bad;
    });

    expect(error).toEqual(expect.any(GherkinError));
    expect(error.code).toEqual("invalid_parameter_type");
    expect(error.data).toEqual({ character: ".", method: "bad", name: "bad.name" });
    expect(errorShape(error)).toMatchSnapshot();
  });

  test("should throw invalid_parameter_type for an unsupported regexp flag at decoration time", () => {
    const error = capture(() => {
      class Bad {
        @ParameterType("flagged", /y/i)
        static flagged(raw: string): string {
          return raw;
        }
      }
      return Bad;
    });

    expect(error).toEqual(expect.any(GherkinError));
    expect(error.code).toEqual("invalid_parameter_type");
    expect(error.data).toEqual({ flag: "i", method: "flagged", name: "flagged" });
    expect(errorShape(error)).toMatchSnapshot();
  });

  test("should reject an unsupported flag anywhere in a regexp array", () => {
    const error = capture(() => {
      class Bad {
        @ParameterType("flagged", [/a/, /b/g])
        static flagged(raw: string): string {
          return raw;
        }
      }
      return Bad;
    });

    expect(error.code).toEqual("invalid_parameter_type");
    expect(error.data).toEqual({ flag: "g", method: "flagged", name: "flagged" });
  });

  test("should accept the flags cucumber accepts", () => {
    class DotAll {
      @ParameterType("dotall", /a.b/su)
      static dotall(raw: string): string {
        return raw;
      }
    }

    expect(
      (metadataOf(DotAll)[PARAMETER_TYPES_METADATA] as Array<StagedParameterType>).map(
        (staged) => staged.name,
      ),
    ).toEqual(["dotall"]);
  });

  test("should throw invalid_parameter_type for an empty regexp array at decoration time", () => {
    const error = capture(() => {
      class Bad {
        @ParameterType("empty", [])
        static empty(raw: string): string {
          return raw;
        }
      }
      return Bad;
    });

    expect(error).toEqual(expect.any(GherkinError));
    expect(error.code).toEqual("invalid_parameter_type");
    expect(error.data).toEqual({ method: "empty", name: "empty" });
    expect(errorShape(error)).toMatchSnapshot();
  });

  test("flag validation should stay aligned with the shipped cucumber implementation", () => {
    const flags = ["d", "g", "i", "m", "s", "u", "v", "y"];

    const cucumberRejects = (regexp: RegExp): boolean => {
      try {
        new CucumberParameterType<unknown>(
          "flagged",
          regexp,
          null,
          (raw: string) => raw,
          false,
          false,
        );
        return false;
      } catch {
        return true;
      }
    };

    for (const flag of flags) {
      const regexp = new RegExp("x", flag);

      const declares = (): unknown => {
        class Fixture {
          @ParameterType("flagged", regexp)
          static transform(raw: string): string {
            return raw;
          }
        }
        return Fixture;
      };

      if (cucumberRejects(regexp)) {
        expect(declares).toThrow(GherkinError);
      } else {
        expect(declares).not.toThrow();
      }
    }
  });

  test("name validation should stay aligned with the shipped cucumber implementation", () => {
    const names = [
      "algorithm",
      "with space",
      "café",
      "{x}",
      "curly{brace",
      "bad.name",
      "a[b",
      "a]b",
      "a(b",
      "a)b",
      "a$b",
      "a|b",
      "a?b",
      "a*b",
      "x+y",
      "a\\[b",
      "a\\+b",
    ];

    for (const name of names) {
      const declares = (): unknown => {
        class Fixture {
          @ParameterType(name, /\w+/)
          static transform(raw: string): string {
            return raw;
          }
        }
        return Fixture;
      };

      if (CucumberParameterType.isValidParameterTypeName(name)) {
        expect(declares).not.toThrow();
      } else {
        expect(declares).toThrow(GherkinError);
      }
    }
  });
});
