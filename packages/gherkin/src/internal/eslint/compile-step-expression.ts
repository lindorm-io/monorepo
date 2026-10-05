import type { ParameterTypeRegistry } from "@cucumber/cucumber-expressions";
import { CucumberExpression } from "@cucumber/cucumber-expressions";

export const compileStepExpression = (
  expression: string,
  registry: ParameterTypeRegistry,
): CucumberExpression | undefined => {
  try {
    return new CucumberExpression(expression, registry);
  } catch {
    // The test run fails on an expression cucumber refuses (build-registry.ts), so the
    // rule leaves it unreported.
    return undefined;
  }
};
