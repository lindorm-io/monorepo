import { isNumber } from "@lindorm/is";
import type { ParseErrorEntry, ParseErrorModel } from "../../model/types.js";
import { joinBlocks } from "./join-blocks.js";

/**
 * Some parser exceptions genuinely carry no location (NoSuchLanguageException),
 * and an AstBuilderException can carry a line without a column — the anchor
 * renders as much position as the entry has, the uri alone at minimum.
 */
const toAnchor = (entry: ParseErrorEntry, uri: string): string => {
  if (isNumber(entry.line) && isNumber(entry.column)) {
    return `${uri}:${entry.line}:${entry.column}`;
  }

  if (isNumber(entry.line)) {
    return `${uri}:${entry.line}`;
  }

  return uri;
};

/**
 * The reporter prints only the thrown MESSAGE, so every parser error must be
 * anchored here — entries living in error.data alone would make a syntax
 * error the one failure that points at nothing.
 */
export const formatParseError = (model: ParseErrorModel): string =>
  joinBlocks([
    "Failed to parse feature file",
    ...model.errors.map(
      (entry) => `  ${entry.message}\n  at ${toAnchor(entry, model.uri)}`,
    ),
    "Fix the first error first — later ones are often knock-ons.",
  ]);
