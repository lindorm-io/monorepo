import { isString } from "@lindorm/is";
import type * as ESTree from "estree";
import type { GherkinCall, GherkinImports } from "./types.js";

// typescript-eslint's parser puts `decorators` on class and member nodes; @types/estree
// declares none, and espree omits the field.
type Decorated = { decorators?: Array<{ expression: ESTree.Expression }> };

const readExportName = (
  callee: ESTree.Expression | ESTree.Super,
  imports: GherkinImports,
): string | undefined => {
  if (callee.type === "Identifier") {
    return imports.exportNameByLocalName.get(callee.name);
  }

  if (
    callee.type === "MemberExpression" &&
    callee.computed === false &&
    callee.object.type === "Identifier" &&
    callee.property.type === "Identifier" &&
    imports.namespaces.has(callee.object.name)
  ) {
    return callee.property.name;
  }

  return undefined;
};

export const readGherkinCalls = (
  node: ESTree.Node,
  imports: GherkinImports,
): Array<GherkinCall> =>
  ((node as Decorated).decorators ?? []).flatMap(({ expression }) => {
    if (expression.type !== "CallExpression") {
      return [];
    }

    const exportName = readExportName(expression.callee, imports);

    return isString(exportName) ? [{ args: expression.arguments, exportName }] : [];
  });
