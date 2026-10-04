import type { IncompleteScenarioNode } from "../../model/types.js";
import { formatAnchor } from "./format-anchor.js";
import { joinBlocks } from "./join-blocks.js";

export const INCOMPLETE_SCENARIO_RULE =
  "Every scenario needs at least one Given and at least one Then: an And or But counts as the keyword it continues, a Background's Given counts, and a * step counts as neither, since it states nothing about which steps assert.";

export const formatIncompleteScenario = (
  node: IncompleteScenarioNode,
  uri: string,
): string =>
  joinBlocks([
    "Incomplete scenario",
    formatAnchor(node.name, uri, node.line, node.column),
    `The scenario has ${node.missingKeywords.map((keyword) => `no ${keyword} step`).join(" and ")}. ${INCOMPLETE_SCENARIO_RULE}`,
  ]);
