import type * as ESTree from "estree";

export type GherkinImports = {
  exportNameByLocalName: Map<string, string>;
  namespaces: Set<string>;
};

export type GherkinCall = {
  args: Array<ESTree.Expression | ESTree.SpreadElement>;
  exportName: string;
};

export type StepDeclaration = {
  expression: string;
  node: ESTree.Node;
};

export type LiteralParameterType = {
  name: string;
  regexps: Array<RegExp>;
};

export type ClassDeclarations = {
  parameterTypes: Array<LiteralParameterType>;
  steps: Array<StepDeclaration>;
};
