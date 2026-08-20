import type { Feature, Scenario, Tag } from "@cucumber/messages";
import { isObject } from "@lindorm/is";
import { requireColumn } from "./require-column.js";

export type AstTag = {
  column: number;
  line: number;
  /** As authored, `@` kept — the model's one spelling (to-vitest-tags.ts strips). */
  name: string;
};

const toAstTag = (tag: Tag): AstTag => ({
  column: requireColumn(tag.location),
  line: tag.location.line,
  name: tag.name,
});

const scenarioTags = (scenario: Scenario): Array<AstTag> => [
  ...scenario.tags.map(toAstTag),
  ...scenario.examples.flatMap((examples) => examples.tags.map(toAstTag)),
];

/**
 * Every tag token in the document, all four taggable levels (feature, rule,
 * scenario, examples — Background cannot be tagged), in document order with
 * feature-file locations. The AST is the SUPERSET of what any pickle carries:
 * a tag on a zero-pickle node (a zero-row Examples block) exists only here,
 * which is what the reserved-tag check (assert-supported-tags.ts) and the
 * config-time declaration scan (scan-tag-declarations.ts) both need.
 */
export const collectAstTags = (feature: Feature): Array<AstTag> => {
  const tags = feature.tags.map(toAstTag);

  for (const child of feature.children) {
    if (isObject(child.rule)) {
      tags.push(...child.rule.tags.map(toAstTag));

      for (const ruleChild of child.rule.children) {
        if (isObject(ruleChild.scenario)) {
          tags.push(...scenarioTags(ruleChild.scenario));
        }
      }
      continue;
    }

    if (isObject(child.scenario)) {
      tags.push(...scenarioTags(child.scenario));
    }
  }

  return tags;
};
