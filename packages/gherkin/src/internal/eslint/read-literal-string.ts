import { isString } from "@lindorm/is";
import type * as ESTree from "estree";

export const readLiteralString = (node: ESTree.Node): string | undefined => {
  if (node.type === "Literal" && isString(node.value)) {
    return node.value;
  }

  if (node.type === "TemplateLiteral" && node.expressions.length === 0) {
    return node.quasis[0].value.cooked ?? undefined;
  }

  return undefined;
};
