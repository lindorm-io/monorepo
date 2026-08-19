import type { EmptyExamplesNode } from "../../model/types.js";
import { formatAnchor } from "./format-anchor.js";
import { joinBlocks } from "./join-blocks.js";

/** Anchored to the `Examples:` line — the empty table is the authoring error. */
export const formatEmptyExamples = (node: EmptyExamplesNode, uri: string): string =>
  joinBlocks([
    "Empty Examples table",
    formatAnchor(node.name, uri, node.line, node.column),
    "The Examples table has a header and zero data rows, so the outline compiles to zero scenarios. Add data rows, or delete the block.",
  ]);
