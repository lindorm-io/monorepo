import { describe, expect, test } from "vitest";
import { omitNotStated } from "./omit-not-stated.js";

describe("omitNotStated", () => {
  test("strips a top-level null and undefined, and nothing else", () => {
    expect(
      omitNotStated({ a: null, b: undefined, c: "", d: [], e: {}, f: 0, g: false }),
    ).toEqual({ c: "", d: [], e: {}, f: 0, g: false });
  });

  // A nested null is a MEMBER, and members are the walker's question.
  test("leaves a nested null untouched", () => {
    expect(omitNotStated({ cnf: { jkt: null, kid: "k1" }, x: [null] })).toEqual({
      cnf: { jkt: null, kid: "k1" },
      x: [null],
    });
  });

  test("carries an own __proto__ key as an own key", () => {
    const dict = JSON.parse('{"__proto__":{"aud":"forged"},"sub":"u1"}');

    const result = omitNotStated(dict);

    expect(Object.hasOwn(result, "__proto__")).toBe(true);
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
    expect(result.aud).toBeUndefined();
  });
});
