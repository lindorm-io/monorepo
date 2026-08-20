import { isUndefined } from "@lindorm/is";
import { GherkinError } from "../../errors/GherkinError.js";
import { formatTagError } from "../execute/format/format-tag-error.js";
import type { AstTag } from "./collect-ast-tags.js";

/**
 * Vitest's own `test.tags` name rules, mirrored from the shipped validator
 * (vitest 4.1.4 `dist/chunks/coverage.Da5gzbsu.js` — whitespace, then
 * `! ( ) * | &`, then a logical operator). It rejects at config resolution
 * with a bare internal stack, BEFORE any transform runs, so the offending
 * `.feature` file is unfindable from the message — hence the same rules run
 * here, where the tag's line and column are in hand.
 *
 * Uniqueness (vitest's fourth rule) is not checked: the declaration scan
 * deduplicates and skips user-declared names (scan-tag-declarations.ts).
 * An EMPTY name is unreachable — the Gherkin parser emits no tag at all for
 * a bare `@` (measured on @cucumber/gherkin 42).
 */
const toReason = (name: string): string | undefined => {
  if (/\s/.test(name)) {
    return "vitest tag names cannot contain whitespace";
  }

  if (/[!()*|&]/.test(name)) {
    return 'vitest tag names cannot contain "!", "*", "&", "|", "(" or ")"';
  }

  if (/^(and|or|not)$/i.test(name)) {
    return 'vitest tag names cannot be a logical operator — "and", "or" or "not"';
  }

  return undefined;
};

/**
 * A Gherkin tag becomes a vitest tag with the `@` stripped, so a
 * parser-legal tag can still be an illegal vitest tag name — `@issue(1234)`,
 * a real Cucumber convention, is the common case. Anchored to the tag's own
 * feature line, like every other authoring error.
 */
export const assertTagNames = (tags: Array<AstTag>, uri: string): void => {
  for (const tag of tags) {
    // The vitest-side spelling is what vitest validates (to-vitest-tags.ts is
    // the one place that strips), so `@not` is the reserved word, not "@not".
    const reason = toReason(tag.name.replace(/^@/, ""));

    if (isUndefined(reason)) {
      continue;
    }

    throw new GherkinError(formatTagError("Invalid tag name", tag, uri, reason), {
      code: "invalid_tag_name",
      title: "Invalid Tag Name",
      details:
        "Gherkin tags are registered as vitest tags with the `@` stripped, and vitest rejects this name at config resolution — where no feature file is named. Rename the tag: `@issue(1234)` becomes e.g. `@issue-1234`.",
      data: { column: tag.column, line: tag.line, tag: tag.name, uri },
    });
  }
};
