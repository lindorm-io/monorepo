/**
 * THE one boundary where Gherkin tag spelling becomes vitest tag spelling:
 * the leading `@` is stripped and duplicates collapse (a tag inherited from
 * feature AND scenario level arrives twice on a pickle). Everywhere else —
 * model nodes, hook expressions, the settings `tags` expression — tags keep
 * the authored `@`; a second stripping site would be the drift this single
 * function exists to prevent.
 */
export const toVitestTags = (tags: Array<string>): Array<string> => [
  ...new Set(tags.map((tag) => tag.replace(/^@/, ""))),
];
