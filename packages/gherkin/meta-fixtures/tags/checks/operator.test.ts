import { expect, test } from "vitest";

// "operator-only" exists ONLY in the user config's test.tags — if the
// plugin's config hook clobbered instead of merged, strictTags fails this
// file's collection.
test("user-declared tags survive the plugin's merge", { tags: ["operator-only"] }, () => {
  expect(true).toBe(true);
});
