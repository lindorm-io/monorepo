import { isUndefined } from "@lindorm/is";
import { GherkinError } from "../../errors/GherkinError.js";
import { formatTagError } from "../execute/format/format-tag-error.js";
import type { AstTag } from "./collect-ast-tags.js";

/**
 * Tags that carry runner meaning ELSEWHERE — @concurrent/@sequential are
 * quickpickle's, @ignore is Reqnroll's, @skip/@todo/@fails circulate across
 * runners. NO tag carries runner meaning here (matching Cucumber), and an
 * accepted-but-inert modifier would be a lie, so each fails loudly instead.
 * There is deliberately no skip tag: a per-scenario skip is a hide-a-red-row
 * escape hatch, while the config `tags` expression is a reviewable lane
 * decision (README.md#tags; pinned per tag: assert-supported-tags.test.ts).
 */
const RESERVED_TAGS = new Map<string, string>([
  ["@concurrent", "concurrency is not supported"],
  ["@sequential", "concurrency is not supported"],
  ["@skip", "this runner has no skip tag — exclude via `tags` in config"],
  ["@ignore", "this runner has no skip tag — exclude via `tags` in config"],
  ["@todo", "this runner has no skip tag — exclude via `tags` in config"],
  ["@fails", "this runner has no skip tag — exclude via `tags` in config"],
]);

/**
 * Runs over EVERY taggable AST node (collect-ast-tags.ts) — including nodes
 * that compile to zero pickles and scenarios a `tags` expression would
 * exclude, so a reserved tag can never ride an excluded lane into silence.
 * Throwing fails the TRANSFORM: a loud collection failure, before any test
 * exists.
 */
export const assertSupportedTags = (tags: Array<AstTag>, uri: string): void => {
  for (const tag of tags) {
    const reason = RESERVED_TAGS.get(tag.name);

    if (isUndefined(reason)) {
      continue;
    }

    throw new GherkinError(formatTagError("Unsupported tag", tag, uri, reason), {
      code: "unsupported_tag",
      title: "Unsupported Tag",
      details:
        "The tag means something in another Gherkin runner and nothing in this one — a silently ignored modifier is a lie, so it fails loudly. Tags do exactly two jobs here: selecting scenarios (`tags` in config at transform time, --tagsFilter at runtime) and gating hooks. Remove the tag, or express the intent through one of those.",
      data: { column: tag.column, line: tag.line, tag: tag.name, uri },
    });
  }
};
