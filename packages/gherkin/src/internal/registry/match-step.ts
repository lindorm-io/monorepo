import type { Argument, CucumberExpression } from "@cucumber/cucumber-expressions";
import type { StepArgument, StepDefinition, StepMatch } from "./types.js";

export type CompiledStep = {
  definition: StepDefinition;
  expression: CucumberExpression;
};

const toStepArgument = (argument: Argument): StepArgument => ({
  // An expression-matched parameter type was resolved by name
  // (ParameterTypeRegistry.lookupByTypeName), so `name` is a defined string
  // here even though ParameterType declares it optional.
  parameterTypeName: argument.getParameterType().name as string,
  raw: argument.group.value,
  value: () => argument.getValue(null),
});

export const matchStep = (
  compiled: Array<CompiledStep>,
  text: string,
): StepMatch | undefined => {
  const matches: Array<{ definition: StepDefinition; args: ReadonlyArray<Argument> }> =
    [];

  for (const { definition, expression } of compiled) {
    const args = expression.match(text);

    if (args !== null) {
      matches.push({ definition, args });
    }
  }

  if (matches.length === 0) {
    return undefined;
  }

  if (matches.length === 1) {
    const [{ definition, args }] = matches;

    return { outcome: "matched", definition, args: args.map(toStepArgument) };
  }

  return {
    outcome: "ambiguous",
    candidates: matches.map(({ definition }) => definition),
  };
};
