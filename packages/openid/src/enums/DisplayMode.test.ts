import { describe, expect, test } from "vitest";
import { DisplayMode } from "./DisplayMode.js";

describe("DisplayMode", () => {
  test("should match snapshot", () => {
    expect(DisplayMode).toMatchSnapshot();
  });

  test("should carry the OIDC Core section 3.1.2.1 values", () => {
    expect(Object.values(DisplayMode)).toEqual(["page", "popup", "touch", "wap"]);
  });

  test("should derive a closed type from the runtime values", () => {
    const fromEnum: DisplayMode = DisplayMode.Page;
    const fromLiteral: DisplayMode = "wap";

    expect([fromEnum, fromLiteral]).toMatchSnapshot();
  });
});
