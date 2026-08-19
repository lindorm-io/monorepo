import { Errors } from "@cucumber/gherkin";
import { isNumber, isObject } from "@lindorm/is";
import { GherkinError } from "../../errors/GherkinError.js";
import { formatParseError } from "../execute/format/format-parse-error.js";
import type { ParseErrorEntry, ParseErrorModel } from "./types.js";

const toEntry = (error: Error): ParseErrorEntry => {
  const entry: ParseErrorEntry = { message: error.message };

  // `location` is typed required but assigned from an optional parameter
  // (Errors.js _create / NoSuchLanguageException.create), so it is genuinely
  // absent at runtime for some exceptions — guard, never trust the type.
  if (error instanceof Errors.GherkinException && isObject(error.location)) {
    entry.line = error.location.line;
    if (isNumber(error.location.column)) {
      entry.column = error.location.column;
    }
  }

  return entry;
};

/**
 * Maps a caught parser throw to anchored entries. With the parser's default
 * `stopAtFirstError = false` every failure arrives as a
 * CompositeParserException (also a single error, also an unknown `# language:`
 * — Parser.js collects them all); the single-exception path guards the
 * `stopAtFirstError` configuration and any raw AstBuilderException escaping
 * `builder.getResult()`. Anything that is not a Gherkin exception is not a
 * feature-file authoring error and is rethrown untouched.
 */
export const toParseErrorEntries = (error: unknown): Array<ParseErrorEntry> => {
  if (error instanceof Errors.CompositeParserException) {
    return error.errors.map(toEntry);
  }

  if (error instanceof Errors.GherkinException) {
    return [toEntry(error)];
  }

  throw error;
};

export const createParseError = (model: ParseErrorModel): GherkinError =>
  new GherkinError(formatParseError(model), {
    code: "parse_error",
    title: "Gherkin Parse Error",
    details:
      "The feature file is not valid Gherkin. Every location is a line in the feature file itself. Fix the first error first — later ones are often knock-ons.",
    data: { errors: model.errors, uri: model.uri },
  });
