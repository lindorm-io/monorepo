import type { IncludeSpec } from "../../types/query";
import { partitionIncludes } from "./partition-includes";
import { describe, expect, test } from "vitest";

const makeInclude = (relation: string, strategy: "join" | "query"): IncludeSpec => ({
  relation,
  required: false,
  strategy,
  select: null,
  where: null,
});

describe("partitionIncludes", () => {
  test("should return empty arrays for empty includes", () => {
    const result = partitionIncludes([]);
    expect(result).toMatchSnapshot();
  });

  test("should put all join includes in joinIncludes", () => {
    const includes = [makeInclude("author", "join"), makeInclude("profile", "join")];
    const result = partitionIncludes(includes);
    expect(result).toMatchSnapshot();
  });

  test("should put all query includes in queryIncludes", () => {
    const includes = [makeInclude("posts", "query"), makeInclude("tags", "query")];
    const result = partitionIncludes(includes);
    expect(result).toMatchSnapshot();
  });

  test("should split mixed includes correctly", () => {
    const includes = [
      makeInclude("author", "join"),
      makeInclude("posts", "query"),
      makeInclude("profile", "join"),
      makeInclude("tags", "query"),
    ];
    const result = partitionIncludes(includes);
    expect(result).toMatchSnapshot();
  });
});
