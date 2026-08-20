import { AstBuilder, GherkinClassicTokenMatcher, Parser } from "@cucumber/gherkin";
import { IdGenerator } from "@cucumber/messages";
import { isUndefined } from "@lindorm/is";
import type { AstTag } from "../model/collect-ast-tags.js";
import { collectAstTags } from "../model/collect-ast-tags.js";

/**
 * Every tag in one feature source WITH its line and column, via the REAL
 * parser — all four taggable levels, because the AST is the superset of what
 * any registered test can carry (collect-ast-tags.ts), so a declaration
 * union built from it cannot miss a tag and trip strictTags. Locations
 * travel with the names so the scan can anchor an invalid vitest tag NAME to
 * its feature line (scan-tag-declarations.ts) — vitest's own rejection names
 * no file at all.
 *
 * A source the parser rejects contributes nothing: the transform reports
 * that file's parse error as a failing test, and the scan must not preempt
 * it with a config-time death.
 */
export const collectFeatureTags = (source: string): Array<AstTag> => {
  const parser = new Parser(
    new AstBuilder(IdGenerator.incrementing()),
    new GherkinClassicTokenMatcher(),
  );

  try {
    const document = parser.parse(source);

    if (isUndefined(document.feature)) {
      return [];
    }

    return collectAstTags(document.feature);
  } catch {
    return [];
  }
};
