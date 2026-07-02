import { lindormSymbol } from "./lindorm-symbol.js";
import { describe, expect, test } from "vitest";

describe("lindormSymbol", () => {
  test("builds a urn:lindorm:<pkg>:<kind>:<name> global symbol", () => {
    expect(lindormSymbol("kryptos", "brand", "kryptos")).toBe(
      Symbol.for("urn:lindorm:kryptos:brand:kryptos"),
    );
  });

  test("is registry-stable: same args resolve to the same symbol", () => {
    expect(lindormSymbol("pylon", "source", "audit")).toBe(
      lindormSymbol("pylon", "source", "audit"),
    );
  });

  test("different coordinates resolve to different symbols", () => {
    expect(lindormSymbol("proteus", "marker", "lazy-collection")).not.toBe(
      lindormSymbol("proteus", "marker", "lazy-relation"),
    );
  });
});
