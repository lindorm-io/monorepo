import { sec } from "./sec.js";
import { describe, expect, test } from "vitest";

describe("sec", () => {
  test("should resolve seconds", () => {
    expect(sec("4 seconds")).toEqual(4);
  });

  test("should resolve readable time", () => {
    expect(sec(5)).toEqual("5s");
  });
});
