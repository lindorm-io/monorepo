import type { SuiteNode } from "./types.js";

/**
 * Counted from the finished tree, independently of any emitter walk — the
 * transform-time half of the structural invariant (registered tests must
 * equal this number), so the two derivations cross-check each other.
 */
export const countExpectedTests = (children: Array<SuiteNode>): number => {
  let count = 0;

  for (const node of children) {
    count += node.kind === "rule" ? countExpectedTests(node.children) : 1;
  }

  return count;
};
