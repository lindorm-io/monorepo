import { isRegExp, isUndefined } from "@lindorm/is";
import type * as ESTree from "estree";

const readRegExp = (node: ESTree.Node | null): RegExp | undefined =>
  node?.type === "Literal" && isRegExp(node.value) ? node.value : undefined;

export const readLiteralRegexps = (
  node: ESTree.Node | undefined,
): Array<RegExp> | undefined => {
  if (isUndefined(node)) {
    return undefined;
  }

  const regexp = readRegExp(node);

  if (isRegExp(regexp)) {
    return [regexp];
  }

  if (node.type !== "ArrayExpression") {
    return undefined;
  }

  const regexps = node.elements.map(readRegExp);

  return regexps.every(isRegExp) ? regexps : undefined;
};
