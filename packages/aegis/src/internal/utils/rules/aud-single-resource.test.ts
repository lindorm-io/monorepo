import { describe, expect, test } from "vitest";
import { audSingleResource } from "./aud-single-resource.js";

describe("audSingleResource", () => {
  test("passes when aud is absent", () => {
    expect(audSingleResource({})).toEqual([]);
  });

  test("passes for an array of exactly one", () => {
    expect(audSingleResource({ audience: ["https://rs"] })).toEqual([]);
  });

  test("passes for a bare string", () => {
    expect(audSingleResource({ audience: "https://rs" })).toEqual([]);
  });

  test("fails for an empty array", () => {
    expect(audSingleResource({ audience: [] })).toMatchSnapshot();
  });

  test("fails for multiple audiences", () => {
    expect(audSingleResource({ audience: ["https://a", "https://b"] })).toMatchSnapshot();
  });
});
