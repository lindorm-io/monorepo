import type { EmptyScenarioNode } from "../../model/types.js";
import { formatAnchor } from "./format-anchor.js";
import { joinBlocks } from "./join-blocks.js";

export const formatEmptyScenario = (node: EmptyScenarioNode, uri: string): string =>
  joinBlocks([
    "Empty scenario",
    formatAnchor(node.name, uri, node.line, node.column),
    "The scenario has a name and zero steps — running it would report green having executed nothing. Write its steps, or delete it.",
  ]);
