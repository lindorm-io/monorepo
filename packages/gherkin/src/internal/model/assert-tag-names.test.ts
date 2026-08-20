import { describe, expect, test } from "vitest";
import { capture, errorShape } from "../../__fixtures__/test-helpers.js";
import { assertTagNames } from "./assert-tag-names.js";

const uri = "src/features/tags.feature";

const tag = (name: string) => ({ column: 3, line: 4, name });

describe("assertTagNames", () => {
  test.each(["@issue(1234)", "@a|b", "@x&y", "@!neg", "@star*"])(
    "should reject %s — vitest forbids the character in a tag name",
    (name) => {
      const error = capture(() => assertTagNames([tag(name)], uri));

      expect(error.code).toBe("invalid_tag_name");
      expect(error.message).toContain(
        'vitest tag names cannot contain "!", "*", "&", "|", "(" or ")"',
      );
      expect(error.message).toContain(`  ${name}`);
      expect(error.message).toContain(`at ${uri}:4:3`);
    },
  );

  test.each(["@not", "@and", "@OR"])(
    "should reject %s — vitest forbids a logical-operator name, case-insensitively",
    (name) => {
      const error = capture(() => assertTagNames([tag(name)], uri));

      expect(error.code).toBe("invalid_tag_name");
      expect(error.message).toContain("cannot be a logical operator");
    },
  );

  test("should reject whitespace in a tag name", () => {
    // Unreachable through the Gherkin parser (tags are whitespace-separated),
    // so it is pinned on the validator directly — vitest rejects it, and the
    // rules are mirrored in full rather than in the subset reachable today.
    const error = capture(() => assertTagNames([tag("@two words")], uri));

    expect(error.code).toBe("invalid_tag_name");
    expect(error.message).toContain("cannot contain whitespace");
  });

  test("should carry the full house error shape, anchored to the tag's own line", () => {
    const error = capture(() => assertTagNames([tag("@issue(1234)")], uri));

    expect(error.data).toEqual({ column: 3, line: 4, tag: "@issue(1234)", uri });
    expect(errorShape(error)).toMatchSnapshot();
  });

  test("should validate the STRIPPED name — the leading @ is not what vitest sees", () => {
    // "@not" strips to "not", the reserved word. Were the @-prefixed
    // spelling validated instead, "@not" would pass here and die at vitest's
    // config resolution with no anchor.
    expect(() => assertTagNames([tag("@nothing")], uri)).not.toThrow();
    expect(capture(() => assertTagNames([tag("@not")], uri)).code).toBe(
      "invalid_tag_name",
    );
  });

  test("should accept ordinary tag names", () => {
    expect(() =>
      assertTagNames([tag("@smoke"), tag("@issue-1234"), tag("@lane.2")], uri),
    ).not.toThrow();
  });

  test("should stay silent for no tags at all", () => {
    expect(() => assertTagNames([], uri)).not.toThrow();
  });
});
