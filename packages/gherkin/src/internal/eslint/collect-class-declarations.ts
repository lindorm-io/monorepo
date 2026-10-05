import { isArray, isString, isUndefined } from "@lindorm/is";
import type * as ESTree from "estree";
import type { StepDecoratorName } from "../metadata/staged.js";
import { readGherkinCalls } from "./read-gherkin-calls.js";
import { readLiteralRegexps } from "./read-literal-regexps.js";
import { readLiteralString } from "./read-literal-string.js";
import type {
  ClassDeclarations,
  GherkinCall,
  GherkinImports,
  LiteralParameterType,
  StepDeclaration,
} from "./types.js";

const STEP_DECORATORS: Record<StepDecoratorName, true> = {
  Given: true,
  Then: true,
  When: true,
};

const toStepDeclarations = ({
  args: [node],
  exportName,
}: GherkinCall): Array<StepDeclaration> => {
  // Object.hasOwn: exportName comes from the consumer's import, not a closed list.
  if (Object.hasOwn(STEP_DECORATORS, exportName) === false || isUndefined(node)) {
    return [];
  }

  const expression = readLiteralString(node);

  return isString(expression) ? [{ expression, node }] : [];
};

const toLiteralParameterTypes = ({
  args: [nameNode, regexpNode],
  exportName,
}: GherkinCall): Array<LiteralParameterType> => {
  if (exportName !== "ParameterType" || isUndefined(nameNode)) {
    return [];
  }

  const name = readLiteralString(nameNode);
  const regexps = readLiteralRegexps(regexpNode);

  return isString(name) && isArray(regexps) ? [{ name, regexps }] : [];
};

export const collectClassDeclarations = (
  node: ESTree.Class,
  imports: GherkinImports,
): ClassDeclarations => {
  const calls = node.body.body.flatMap((member) => readGherkinCalls(member, imports));
  // Only @Binding registers its own parameter types (Binding.ts); a declaration on any
  // other class never reaches the runtime registry.
  const registered = readGherkinCalls(node, imports).some(
    ({ exportName }) => exportName === "Binding",
  );

  return {
    parameterTypes: registered ? calls.flatMap(toLiteralParameterTypes) : [],
    steps: calls.flatMap(toStepDeclarations),
  };
};
