import { beforeEach, describe, expect, test } from "vitest";
import { capture, errorShape } from "../../__fixtures__/test-helpers.js";
import { Binding } from "../../decorators/Binding.js";
import { Given } from "../../decorators/Given.js";
import { ParameterType } from "../../decorators/ParameterType.js";
import { When } from "../../decorators/When.js";
import { GherkinError } from "../../errors/GherkinError.js";
import { buildRegistry } from "./build-registry.js";
import { drainRegistrations } from "./registrations.js";
import type { ResolvedMatch, StepMatch } from "./types.js";

const matched = (match: StepMatch | undefined): ResolvedMatch => {
  if (match?.outcome === "matched") {
    return match;
  }
  throw new Error("expected a matched step");
};

// Module A uses {encryption}, declared in module B, so a successful build
// proves parameter types register across ALL modules before ANY expression
// builds.
@Binding()
class AesSteps {
  @Given('an oct key with algorithm "{algorithm}" and encryption "{encryption}"')
  anOctKey(_algorithm: string, _encryption: string): void {}

  @When("I encrypt {string}")
  iEncrypt(_content: string): void {}

  @ParameterType("algorithm", /[A-Za-z0-9-]+/)
  static algorithm(raw: string): string {
    // `this` must be the declaring class at transform time.
    return this.normalise(raw);
  }

  static normalise(raw: string): string {
    return `alg:${raw}`;
  }
}

const moduleA = { modulePath: "src/aes.steps.ts", registrations: drainRegistrations() };

@Binding()
class TransformSteps {
  static calls = 0;

  // Same regexp source as {algorithm} — registration of both pins
  // preferForRegexpMatch=false.
  @ParameterType("encryption", /[A-Za-z0-9-]+/, { useForSnippets: true })
  static encryption(raw: string): string {
    return raw.toLowerCase();
  }

  @ParameterType("counted", /\d+/)
  static counted(raw: string): number {
    TransformSteps.calls += 1;
    return Number(raw);
  }

  @ParameterType("later", /[a-z]+/)
  static async later(raw: string): Promise<string> {
    return `later:${raw}`;
  }

  @ParameterType("strict", /[a-z]+/)
  static strict(raw: string): string {
    if (raw === "good") {
      return raw;
    }
    throw new Error(`unknown value "${raw}"`);
  }

  @ParameterType("pair", /(\d+)-(\d+)/)
  static pair(left: string, right: string): Array<number> {
    return [Number(left), Number(right)];
  }

  @Given("count {counted}")
  count(_value: number): void {}

  @Given("resolve {later}")
  resolve(_value: string): void {}

  @Given("value {strict} and {int}")
  value(_strict: string, _int: number): void {}

  @Given("range {pair}")
  range(_pair: Array<number>): void {}
}

const moduleB = {
  modulePath: "src/transforms.steps.ts",
  registrations: drainRegistrations(),
};

@Binding()
class AmbiguousGivenSteps {
  @Given("a key is loaded")
  given(): void {}
}

@Binding()
class AmbiguousWhenSteps {
  @When("a key is loaded")
  when(): void {}
}

const moduleC = {
  modulePath: "src/ambiguous.steps.ts",
  registrations: drainRegistrations(),
};

const modules = [moduleA, moduleB, moduleC];

describe("buildRegistry", () => {
  beforeEach(() => {
    drainRegistrations();
    TransformSteps.calls = 0;
  });

  test("should build when an earlier module's step uses a later module's parameter type", () => {
    const registry = buildRegistry(modules);
    const match = matched(
      registry.match('an oct key with algorithm "A128KW" and encryption "A128GCM"'),
    );

    expect(match.definition).toEqual({
      className: "AesSteps",
      decorator: "Given",
      expression: 'an oct key with algorithm "{algorithm}" and encryption "{encryption}"',
      methodName: "anOctKey",
      modulePath: "src/aes.steps.ts",
      target: AesSteps,
    });
    expect(match.args.map((arg) => arg.parameterTypeName)).toEqual([
      "algorithm",
      "encryption",
    ]);
    expect(match.args[0].value()).toEqual("alg:A128KW");
    expect(match.args[1].value()).toEqual("a128gcm");
  });

  test("should register two parameter types sharing one regexp source", () => {
    const registry = buildRegistry(modules);

    expect(registry.parameterTypeRegistry.lookupByTypeName("algorithm")).toBeDefined();
    expect(registry.parameterTypeRegistry.lookupByTypeName("encryption")).toBeDefined();
  });

  test("should default useForSnippets to false and honour the opt-in", () => {
    const registry = buildRegistry(modules);

    expect(
      registry.parameterTypeRegistry.lookupByTypeName("algorithm")?.useForSnippets,
    ).toEqual(false);
    expect(
      registry.parameterTypeRegistry.lookupByTypeName("encryption")?.useForSnippets,
    ).toEqual(true);
  });

  test("should return undefined when no definition matches", () => {
    expect(buildRegistry(modules).match("no such step")).toBeUndefined();
  });

  test("should strip the quotes of a built-in {string} argument", () => {
    const match = matched(buildRegistry(modules).match('I encrypt "hello world"'));

    expect(match.definition.methodName).toEqual("iEncrypt");
    expect(match.args[0].parameterTypeName).toEqual("string");
    expect(match.args[0].value()).toEqual("hello world");
  });

  test("should carry the raw matched text of every argument for conversion reporting", () => {
    const match = matched(buildRegistry(modules).match("value bad and 3"));

    expect(match.args[0].raw).toEqual("bad");
    expect(match.args[1].raw).toEqual("3");
  });

  test("should record the declaration site of custom parameter types and none for built-ins", () => {
    const registry = buildRegistry(modules);

    expect(registry.parameterTypeDeclarations.get("algorithm")).toEqual({
      className: "AesSteps",
      methodName: "algorithm",
      modulePath: "src/aes.steps.ts",
    });
    expect(registry.parameterTypeDeclarations.get("encryption")).toEqual({
      className: "TransformSteps",
      methodName: "encryption",
      modulePath: "src/transforms.steps.ts",
    });
    expect(registry.parameterTypeDeclarations.get("string")).toBeUndefined();
    expect(registry.parameterTypeDeclarations.get("int")).toBeUndefined();
  });

  test("should not invoke a transform until the argument value is evaluated", () => {
    const match = matched(buildRegistry(modules).match("count 12"));

    expect(TransformSteps.calls).toEqual(0);
    expect(match.args[0].value()).toEqual(12);
    expect(TransformSteps.calls).toEqual(1);
  });

  test("should return the promise of an async transform for the runner to await", async () => {
    const match = matched(buildRegistry(modules).match("resolve abc"));

    await expect(match.args[0].value()).resolves.toEqual("later:abc");
  });

  test("should surface a throwing transform on its own argument, named by parameter type", () => {
    const match = matched(buildRegistry(modules).match("value bad and 3"));

    expect(match.args[0].parameterTypeName).toEqual("strict");
    expect(() => match.args[0].value()).toThrow('unknown value "bad"');
    expect(match.args[1].parameterTypeName).toEqual("int");
    expect(match.args[1].value()).toEqual(3);
  });

  test("should convert a passing transform next to a throwing one", () => {
    const match = matched(buildRegistry(modules).match("value good and 3"));

    expect(match.args[0].value()).toEqual("good");
  });

  test("should pass every capture group of a multi-group regexp to the transform", () => {
    const match = matched(buildRegistry(modules).match("range 3-7"));

    expect(match.args).toHaveLength(1);
    expect(match.args[0].value()).toEqual([3, 7]);
  });

  test("should report every candidate of an ambiguous step — keyword has no matching significance", () => {
    const match = buildRegistry(modules).match("a key is loaded");

    expect(match?.outcome).toEqual("ambiguous");
    expect(match?.outcome === "ambiguous" ? match.candidates : []).toEqual([
      {
        className: "AmbiguousGivenSteps",
        decorator: "Given",
        expression: "a key is loaded",
        methodName: "given",
        modulePath: "src/ambiguous.steps.ts",
        target: AmbiguousGivenSteps,
      },
      {
        className: "AmbiguousWhenSteps",
        decorator: "When",
        expression: "a key is loaded",
        methodName: "when",
        modulePath: "src/ambiguous.steps.ts",
        target: AmbiguousWhenSteps,
      },
    ]);
  });

  test("should wrap a duplicate parameter type name, anchored to the second declaration", () => {
    @Binding()
    class DupA {
      @ParameterType("dup", /\w+/)
      static dupA(raw: string): string {
        return raw;
      }
    }
    const first = {
      modulePath: "src/dup-a.steps.ts",
      registrations: drainRegistrations(),
    };

    @Binding()
    class DupB {
      @ParameterType("dup", /\w+/)
      static dupB(raw: string): string {
        return raw;
      }
    }
    const second = {
      modulePath: "src/dup-b.steps.ts",
      registrations: drainRegistrations(),
    };

    expect(first.registrations[0].target).toBe(DupA);
    expect(second.registrations[0].target).toBe(DupB);

    const error = capture(() => buildRegistry([first, second]));

    expect(error).toEqual(expect.any(GherkinError));
    expect(error.code).toEqual("duplicate_parameter_type");
    expect(error.data).toEqual({
      className: "DupB",
      methodName: "dupB",
      modulePath: "src/dup-b.steps.ts",
      name: "dup",
    });
    expect(errorShape(error)).toMatchSnapshot();
  });

  test("should wrap a parameter type duplicating a built-in name", () => {
    @Binding()
    class BuiltinDup {
      @ParameterType("int", /\d+/)
      static int(raw: string): number {
        return Number(raw);
      }
    }
    const module = {
      modulePath: "src/builtin-dup.steps.ts",
      registrations: drainRegistrations(),
    };

    expect(module.registrations[0].target).toBe(BuiltinDup);

    const error = capture(() => buildRegistry([module]));

    expect(error.code).toEqual("duplicate_parameter_type");
    expect(error.data).toEqual({
      className: "BuiltinDup",
      methodName: "int",
      modulePath: "src/builtin-dup.steps.ts",
      name: "int",
    });
  });

  test("should wrap an unknown parameter type, anchored to the step definition", () => {
    @Binding()
    class TypoSteps {
      @Given("uses {nope}")
      typo(): void {}
    }
    const module = {
      modulePath: "src/typo.steps.ts",
      registrations: drainRegistrations(),
    };

    expect(module.registrations[0].target).toBe(TypoSteps);

    const error = capture(() => buildRegistry([module]));

    expect(error).toEqual(expect.any(GherkinError));
    expect(error.code).toEqual("unknown_parameter_type");
    expect(error.data).toEqual({
      className: "TypoSteps",
      expression: "uses {nope}",
      methodName: "typo",
      modulePath: "src/typo.steps.ts",
      name: "nope",
    });
    expect(errorShape(error)).toMatchSnapshot();
  });

  test("should rethrow a malformed expression error unwrapped", () => {
    @Binding()
    class BrokenSteps {
      @Given("an {")
      broken(): void {}
    }
    const module = {
      modulePath: "src/broken.steps.ts",
      registrations: drainRegistrations(),
    };

    expect(module.registrations[0].target).toBe(BrokenSteps);

    const error = capture(() => buildRegistry([module]));

    expect(error).toEqual(expect.any(Error));
    expect(error).not.toEqual(expect.any(GherkinError));
    expect(error.message).toMatchSnapshot();
  });
});
