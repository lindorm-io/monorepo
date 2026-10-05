import { readFileSync } from "node:fs";
import {
  AstBuilder,
  Errors,
  GherkinClassicTokenMatcher,
  Parser,
  compile,
} from "@cucumber/gherkin";
import type { GherkinDocument } from "@cucumber/messages";
import { IdGenerator } from "@cucumber/messages";
import { isUndefined } from "@lindorm/is";

const readSource = (file: string): string | undefined => {
  try {
    return readFileSync(file, "utf8");
  } catch {
    // A file that vanished or denies access contributes no steps. pinned:
    // read-step-texts.test.ts
    return undefined;
  }
};

export const readStepTexts = (file: string): Array<string> | undefined => {
  const source = readSource(file);

  if (isUndefined(source)) {
    return undefined;
  }

  const newId = IdGenerator.incrementing();
  const parser = new Parser(new AstBuilder(newId), new GherkinClassicTokenMatcher());

  let document: GherkinDocument;

  try {
    document = parser.parse(source);
  } catch (error) {
    // A file that does not parse runs no scenario. pinned: read-step-texts.test.ts
    if (error instanceof Errors.GherkinException) {
      return [];
    }

    throw error;
  }

  return compile(document, file, newId).flatMap((pickle) =>
    pickle.steps.map((step) => step.text),
  );
};
