import type * as ESTree from "estree";
import type { GherkinImports } from "./types.js";

const GHERKIN_PACKAGE = "@lindorm/gherkin";

const toExportName = (imported: ESTree.Identifier | ESTree.Literal): string =>
  imported.type === "Identifier" ? imported.name : String(imported.value);

export const readGherkinImports = (program: ESTree.Program): GherkinImports => {
  const imports: GherkinImports = {
    exportNameByLocalName: new Map(),
    namespaces: new Set(),
  };

  for (const statement of program.body) {
    if (
      statement.type !== "ImportDeclaration" ||
      statement.source.value !== GHERKIN_PACKAGE
    ) {
      continue;
    }

    for (const specifier of statement.specifiers) {
      if (specifier.type === "ImportSpecifier") {
        imports.exportNameByLocalName.set(
          specifier.local.name,
          toExportName(specifier.imported),
        );
      }

      if (specifier.type === "ImportNamespaceSpecifier") {
        imports.namespaces.add(specifier.local.name);
      }
    }
  }

  return imports;
};
