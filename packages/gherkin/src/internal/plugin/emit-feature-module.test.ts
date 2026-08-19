import { isString } from "@lindorm/is";
import { parseAst } from "vite";
import { describe, expect, test } from "vitest";
import { buildFeatureModel } from "../model/build-feature-model.js";
import type { FeatureModel } from "../model/types.js";
import { emitFeatureModule } from "./emit-feature-module.js";

const MODEL_PREFIX = "const model = ";

/** JSON.stringify output holds no raw newline, so the literal is one line. */
const extractModel = (source: string): unknown => {
  const line = source.split("\n").find((entry) => entry.startsWith(MODEL_PREFIX));

  if (isString(line)) {
    return JSON.parse(line.slice(MODEL_PREFIX.length, -1));
  }

  throw new Error("emitted source carries no model line");
};

const model = buildFeatureModel(
  ["Feature: emitted module", "", "  Scenario: one", '    Given a step "value"'].join(
    "\n",
  ),
  "src/features/emitted.feature",
);

describe("emitFeatureModule", () => {
  test("should emit the spike-proven module shape", () => {
    expect(
      emitFeatureModule({ model, stepPatterns: ["/src/**/*.steps.ts"] }),
    ).toMatchSnapshot();
  });

  test("should import the runtime from the published subpath", () => {
    const source = emitFeatureModule({ model, stepPatterns: ["/src/**/*.steps.ts"] });

    expect(source.split("\n")[0]).toBe(
      'import { runFeature } from "@lindorm/gherkin/runtime";',
    );
  });

  test("should embed the glob patterns as a serialized literal", () => {
    const source = emitFeatureModule({
      model,
      stepPatterns: ["/src/**/*.steps.ts", "/steps/extra.steps.ts"],
    });

    expect(source).toContain(
      'const stepModules = import.meta.glob(["/src/**/*.steps.ts","/steps/extra.steps.ts"]);',
    );
  });

  test("should top-level await the run", () => {
    const source = emitFeatureModule({ model, stepPatterns: ["/src/**/*.steps.ts"] });

    expect(source).toContain("await runFeature({ model, stepModules });");
  });

  test("should round-trip the model losslessly through the embedded literal", () => {
    const source = emitFeatureModule({ model, stepPatterns: ["/src/**/*.steps.ts"] });

    expect(extractModel(source)).toEqual(model);
  });

  test("should emit byte-identical source for identical input", () => {
    const first = emitFeatureModule({ model, stepPatterns: ["/src/**/*.steps.ts"] });
    const second = emitFeatureModule({ model, stepPatterns: ["/src/**/*.steps.ts"] });

    expect(first).toBe(second);
  });

  describe("hostile content", () => {
    // Hand-built rather than parsed: names in a parsed model cannot carry raw
    // newlines (the grammar is line-based), but the serializer must survive
    // them anyway — it is the single mechanism between authored text and
    // generated code. The lone \uD800 surrogate rides on JSON.stringify's
    // well-formed escaping (ES2019): it must serialize as an escape, parse,
    // and round-trip — never corrupt the emitted literal.
    const hostile: FeatureModel = {
      children: [
        {
          kind: "scenario",
          column: 3,
          line: 3,
          name: 'hostile `name` with ${payload}, "; quotes, back\\slash,\nnewline, \u2028 separator and lone \uD800 surrogate',
          steps: [
            {
              column: 5,
              hasArgument: false,
              line: 4,
              text: 'I write "`${evil}`; \\" injection"',
              type: "Action",
            },
          ],
        },
      ],
      expectedTests: 1,
      kind: "feature",
      line: 1,
      name: 'Feature ${}; import { evil } from "`x`";',
      uri: 'src/__fixtures__/hostile".feature',
    };

    test("should emit source a real parser accepts as a valid module", () => {
      // Control: prove the oracle can go red — parseAst is rollup's real
      // parser and rejects broken source.
      expect(() => parseAst("const = ;")).toThrow();

      const source = emitFeatureModule({
        model: hostile,
        stepPatterns: ["/src/**/*.steps.ts"],
      });

      const program = parseAst(source);

      expect(program.type).toBe("Program");
      expect(program.body).toHaveLength(4);
    });

    test("should round-trip the hostile model losslessly", () => {
      const source = emitFeatureModule({
        model: hostile,
        stepPatterns: ["/src/**/*.steps.ts"],
      });

      expect(extractModel(source)).toEqual(hostile);
    });
  });

  test("should throw when the emitted source carries no model line", () => {
    // Pins the extraction helper's own failure mode so a broken emitter
    // cannot make the round-trip tests vacuously green.
    expect(() => extractModel("const nothing = 1;")).toThrow(
      "emitted source carries no model line",
    );
  });
});
