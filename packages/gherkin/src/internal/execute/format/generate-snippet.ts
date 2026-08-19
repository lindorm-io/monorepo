import type { ParameterTypeRegistry } from "@cucumber/cucumber-expressions";
import { CucumberExpressionGenerator } from "@cucumber/cucumber-expressions";
import type { StepModel } from "../../model/types.js";
import { toMethodName } from "./to-method-name.js";
import { toParameterTsType } from "./to-parameter-ts-type.js";
import { toSnippetDecorator } from "./to-snippet-decorator.js";

/**
 * The pasteable snippet an undefined-step failure carries. The FIRST
 * generated expression is taken: custom parameter types default
 * `useForSnippets` to false, so the first candidate is the tightest
 * expression that will not degrade into a combinatorial parameter mess.
 * Parameter names come from `GeneratedExpression.parameterNames` (the
 * parameter type's name, numbered on repeats — `string`, `string2`); types
 * from `parameterInfos` via to-parameter-ts-type.ts.
 */
export const generateSnippet = (
  step: StepModel,
  parameterTypeRegistry: ParameterTypeRegistry,
): string => {
  const generator = new CucumberExpressionGenerator(
    () => parameterTypeRegistry.parameterTypes,
  );

  const [expression] = generator.generateExpressions(step.text);

  const parameters = expression.parameterInfos
    .map(
      (info, index) =>
        `${expression.parameterNames[index]}: ${toParameterTsType(info.type)}`,
    )
    .join(", ");

  return [
    `@${toSnippetDecorator(step.type)}(${JSON.stringify(expression.source)})`,
    `${toMethodName(expression.source)}(${parameters}): void {`,
    "  throw new PendingStepError();",
    "}",
  ].join("\n");
};
