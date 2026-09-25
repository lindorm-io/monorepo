import { isArray, isString } from "@lindorm/is";
import { GherkinError } from "../errors/GherkinError.js";
import { stageParameterType } from "../internal/metadata/stage-metadata.js";
import type { ParameterTypeOptions } from "../types/parameter-type-options.js";
import type { GherkinMethodDecorator, StepFn } from "../types/step-fn.js";

// Mirrors ParameterType.isValidParameterTypeName (shipped ParameterType.js).
// Cucumber unescapes `\x` sequences before testing, but unescaping only
// deletes backslashes, so an illegal character is present in the raw name iff
// it is present after unescaping — testing the raw name is equivalent. Parity
// with the shipped implementation is pinned by ParameterType.test.ts.
const ILLEGAL_NAME_PATTERN = /([[\]()$.|?*+])/;

// Mirrors regexpSource (shipped ParameterType.js): these four flags throw at
// ParameterType construction; d, s, u and v are accepted. Parity with the
// shipped implementation is pinned by ParameterType.test.ts.
const REJECTED_FLAGS: Array<string> = ["g", "i", "m", "y"];

const findIllegalNameCharacter = (name: string): string | undefined =>
  ILLEGAL_NAME_PATTERN.exec(name)?.[1];

const findRejectedFlag = (regexp: RegExp | Array<RegExp>): string | undefined => {
  const regexps = isArray(regexp) ? regexp : [regexp];

  for (const entry of regexps) {
    for (const flag of REJECTED_FLAGS) {
      if (entry.flags.includes(flag)) {
        return flag;
      }
    }
  }

  return undefined;
};

const validateParameterType = (
  name: string,
  regexp: RegExp | Array<RegExp>,
  method: string,
): void => {
  if (name.length === 0) {
    throw new GherkinError("@ParameterType requires a non-empty name", {
      code: "invalid_parameter_type",
      details:
        "Cucumber's anonymous parameter type owns the empty name, so an empty-named declaration collides with it at registration. Name the parameter type.",
      data: { method, name },
    });
  }

  const character = findIllegalNameCharacter(name);

  if (isString(character)) {
    throw new GherkinError(
      `@ParameterType name "${name}" contains illegal character "${character}"`,
      {
        code: "invalid_parameter_type",
        details:
          "cucumber-expressions rejects parameter type names containing '[', ']', '(', ')', '$', '.', '|', '?', '*' or '+', escaped or not. Rename the parameter type.",
        data: { character, method, name },
      },
    );
  }

  if (isArray(regexp) && regexp.length === 0) {
    throw new GherkinError(`@ParameterType regexp array for "${name}" is empty`, {
      code: "invalid_parameter_type",
      details:
        "An empty regexp array compiles to a group matching only the empty string, so the parameter type can never capture a value. Provide at least one regexp.",
      data: { method, name },
    });
  }

  const flag = findRejectedFlag(regexp);

  if (isString(flag)) {
    throw new GherkinError(
      `@ParameterType regexp for "${name}" uses unsupported flag "${flag}"`,
      {
        code: "invalid_parameter_type",
        details:
          "cucumber-expressions rejects parameter type regexps carrying the g, i, m or y flags. Remove the flag.",
        data: { flag, method, name },
      },
    );
  }
};

/**
 * Declare a custom parameter type on a STATIC method of a `@Binding` class.
 * `{name}` in a step expression resolves to it at registry build; the method
 * transforms the matched string(s) — one argument per regexp capture group —
 * and may be async (the runner awaits it before invoking the step).
 *
 * The regexp is required: cucumber-expressions has no default, and without one
 * `{name}` matches nothing.
 *
 * The name and regexp are validated here, at decoration time: the cucumber
 * ParameterType constructor rejects the same inputs, but at registry-build
 * time and without an anchor. Rejecting them at the declaration site is
 * import-order-independent and names the offending method.
 */
export const ParameterType =
  (
    name: string,
    regexp: RegExp | Array<RegExp>,
    options: ParameterTypeOptions = {},
  ): GherkinMethodDecorator =>
  (target: StepFn, context: ClassMethodDecoratorContext): void => {
    if (context.static === true) {
      validateParameterType(name, regexp, String(context.name));

      stageParameterType(context.metadata, {
        methodName: String(context.name),
        name,
        options,
        regexp,
        transform: target,
      });
      return;
    }

    throw new GherkinError("@ParameterType requires a static method", {
      code: "scope_violation",
      details:
        "A parameter type registers once per registry — scope wider than a scenario — so its transform must be a static method.",
      data: { decorator: "ParameterType", method: String(context.name), name },
    });
  };
