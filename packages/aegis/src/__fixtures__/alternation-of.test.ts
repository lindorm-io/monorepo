import { describe, expect, test } from "vitest";
import { alternationOf } from "./alternation-of.js";

// Anchored as cucumber-expressions anchors a step: only a whole name may bind.
const binds = (names: ReadonlyArray<string>, texts: ReadonlyArray<string>) => {
  const whole = new RegExp(`^(?:${alternationOf(names).source})$`);

  return Object.fromEntries(texts.map((text) => [text, whole.test(text)]));
};

describe("alternationOf", () => {
  test("should bind each name verbatim and nothing a metacharacter would admit", () => {
    expect(
      binds(["a.b", "x|y", "id_token"], ["a.b", "aXb", "x|y", "x", "y", "id_token"]),
    ).toMatchSnapshot();
  });
});
