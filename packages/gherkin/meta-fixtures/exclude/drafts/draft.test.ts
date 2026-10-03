import { expect, test } from "vitest";

// Under the excluded `drafts/**` directory but no feature file: gherkin
// resolves `exclude` to feature files only, so this file stays vitest's to
// collect — pinned by src/e2e/meta-exclude.test.ts.
test("a non-feature test under an excluded directory runs", () => {
  expect(true).toBe(true);
});
