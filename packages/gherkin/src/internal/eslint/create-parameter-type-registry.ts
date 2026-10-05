import { ParameterType, ParameterTypeRegistry } from "@cucumber/cucumber-expressions";
import type { LiteralParameterType } from "./types.js";

const ANY_TEXT = /[\s\S]*/;

// A parameter type the linted file does not declare with a literal regexp cannot be
// evaluated statically, so it matches any text and never makes a reached step look
// unreached. pinned: no-unreached-step.test.ts
class OpenParameterTypeRegistry extends ParameterTypeRegistry {
  lookupByTypeName(typeName: string): ParameterType<unknown> {
    return (
      super.lookupByTypeName(typeName) ?? new ParameterType(typeName, ANY_TEXT, null)
    );
  }
}

export const createParameterTypeRegistry = (
  declarations: Array<LiteralParameterType>,
): ParameterTypeRegistry => {
  const registry = new OpenParameterTypeRegistry();

  for (const { name, regexps } of declarations) {
    try {
      registry.defineParameterType(
        new ParameterType(name, regexps, null, undefined, false, false),
      );
    } catch {
      // Cucumber refuses it, so the test run fails on it — an illegal or empty name or a
      // refused flag at decoration (decorators/ParameterType.ts), a duplicate name at
      // registry build (build-registry.ts); the name keeps the built-in or earlier
      // declaration, or matches any text.
    }
  }

  return registry;
};
